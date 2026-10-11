package dev.wristpilot.forwarder

import android.app.Activity
import android.content.ComponentName
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.service.notification.NotificationListenerService
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Switch
import android.widget.TextView
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import java.io.File

/**
 * One-screen status: is notification access granted, and is the watch link up.
 * Also the developer's drive recorder: a "Record drive" switch and the recordings to share.
 */
class MainActivity : Activity() {
    private val handler = Handler(Looper.getMainLooper())
    private lateinit var access: TextView
    private lateinit var link: TextView
    private lateinit var last: TextView
    private lateinit var grant: Button
    private lateinit var recordings: LinearLayout
    private var shownRecordings: List<File>? = null
    private var lastRebindAt = 0L

    private val refresh = object : Runnable {
        override fun run() {
            render()
            handler.postDelayed(this, 1000)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val pad = (24 * resources.displayMetrics.density).toInt()
        access = TextView(this).apply { textSize = 18f; gravity = Gravity.CENTER }
        link = TextView(this).apply { textSize = 18f; gravity = Gravity.CENTER; setPadding(0, pad / 2, 0, pad / 2) }
        last = TextView(this).apply { gravity = Gravity.CENTER; setPadding(0, 0, 0, pad / 2) }
        grant = Button(this).apply {
            text = "Grant notification access"
            setOnClickListener { startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)) }
        }
        val hint = TextView(this).apply {
            gravity = Gravity.CENTER
            text = "Android 15: if Wristpilot is greyed out in the list, open App info → ⋮ → " +
                "Allow restricted settings, then try again."
        }
        val record = Switch(this).apply {
            text = "Record drive"
            textSize = 18f
            setPadding(0, pad, 0, pad / 2)
            isChecked = DriveRecorder.isOn(this@MainActivity)
            setOnCheckedChangeListener { _, on -> DriveRecorder.setOn(this@MainActivity, on) }
        }
        val recordHint = TextView(this).apply {
            gravity = Gravity.CENTER
            text = "Switch on before a drive and off after it: each recording is one file. " +
                "Tap a recording to share it."
        }
        recordings = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        val screen = ScrollView(this).apply {
            // Fill the screen so short content can be centred vertically.
            isFillViewport = true
            addView(LinearLayout(this@MainActivity).apply {
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER
                layoutParams = ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT,
                )
                setPadding(pad, pad, pad, pad)
                addView(access)
                addView(link)
                addView(last)
                addView(grant)
                addView(hint)
                addView(record)
                addView(recordHint)
                addView(recordings)
            })
        }
        // Android 15 draws apps edge to edge: keep the content clear of the status and nav bars.
        ViewCompat.setOnApplyWindowInsetsListener(screen) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            insets
        }
        setContentView(screen)
    }

    override fun onResume() {
        super.onResume()
        handler.post(refresh)
    }

    override fun onPause() {
        handler.removeCallbacks(refresh)
        super.onPause()
    }

    private fun render() {
        val granted = hasNotificationAccess()
        access.text = if (granted) "✓ Notification access granted" else "✗ Notification access not granted"
        grant.isEnabled = !granted
        val server = MapsNotificationListener.server
        link.text = when {
            !granted -> "✗ Watch link down (needs notification access)"
            server == null -> {
                requestRebind()
                "✗ Watch link down: Android hasn't connected Wristpilot to notifications yet. " +
                    "Reconnecting… If this stays, switch Wristpilot's notification access off and on."
            }
            server.hasFailed -> "✗ Watch link down: port ${SnapshotServer.PORT} is busy, retrying…"
            !server.isRunning -> "… Starting the watch link"
            server.clientCount > 0 -> "✓ Watch link up"
            else -> "… Waiting for Wristpilot on the watch to connect"
        }
        last.text = MapsNotificationListener.lastForwarded?.let {
            val ago = (System.currentTimeMillis() - it.at) / 1000
            "Last Google Maps update: ${ago} s ago (${MapsNotificationListener.forwardedCount} so far)\n" +
                if (it.event == "removed") "notification removed" else "${it.title} · ${it.text}"
        } ?: "No Google Maps update yet"
        renderRecordings()
    }

    private fun renderRecordings() {
        val files = DriveRecorder.recordings(this)
        // Rebuild only when the list changes, so a tap isn't lost to the 1 s refresh.
        if (files == shownRecordings) return
        shownRecordings = files
        recordings.removeAllViews()
        files.forEach { file ->
            recordings.addView(Button(this).apply {
                text = file.name
                isAllCaps = false
                setOnClickListener { startActivity(DriveRecorder.shareIntent(this@MainActivity, file)) }
            })
        }
    }

    /**
     * Access can be granted while Android still hasn't bound the listener (e.g. HyperOS after
     * an app update). Ask it to bind, at most every few seconds.
     */
    private fun requestRebind() {
        val now = System.currentTimeMillis()
        if (now - lastRebindAt < REBIND_EVERY_MS) return
        lastRebindAt = now
        NotificationListenerService.requestRebind(ComponentName(this, MapsNotificationListener::class.java))
    }

    private fun hasNotificationAccess(): Boolean {
        val me = ComponentName(this, MapsNotificationListener::class.java).flattenToString()
        val enabled = Settings.Secure.getString(contentResolver, "enabled_notification_listeners") ?: ""
        return enabled.split(':').any { it == me }
    }

    companion object {
        private const val REBIND_EVERY_MS = 10_000L
    }
}
