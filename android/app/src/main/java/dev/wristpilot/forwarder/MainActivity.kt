package dev.wristpilot.forwarder

import android.app.Activity
import android.content.ComponentName
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Switch
import android.widget.TextView
import java.io.File

/**
 * One-screen status: is notification access granted, and is the watch link up.
 * Also the developer's drive recorder: a "Record drive" switch and the recordings to share.
 */
class MainActivity : Activity() {
    private val handler = Handler(Looper.getMainLooper())
    private lateinit var access: TextView
    private lateinit var link: TextView
    private lateinit var grant: Button
    private lateinit var recordings: LinearLayout
    private var shownRecordings: List<File>? = null

    private val refresh = object : Runnable {
        override fun run() {
            render()
            handler.postDelayed(this, 1000)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val pad = (24 * resources.displayMetrics.density).toInt()
        access = TextView(this).apply { textSize = 18f }
        link = TextView(this).apply { textSize = 18f; setPadding(0, pad / 2, 0, pad / 2) }
        grant = Button(this).apply {
            text = "Grant notification access"
            setOnClickListener { startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)) }
        }
        val hint = TextView(this).apply {
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
            text = "Switch on before a drive and off after it: each recording is one file. " +
                "Tap a recording to share it."
        }
        recordings = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        setContentView(ScrollView(this).apply {
            addView(LinearLayout(this@MainActivity).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(pad, pad, pad, pad)
                addView(access)
                addView(link)
                addView(grant)
                addView(hint)
                addView(record)
                addView(recordHint)
                addView(recordings)
            })
        })
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
            server == null || !server.isRunning ->
                "✗ Watch link down: forwarder not listening on port ${SnapshotServer.PORT}"
            server.clientCount > 0 -> "✓ Watch link up"
            else -> "… Waiting for Wristpilot on the watch to connect"
        }
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

    private fun hasNotificationAccess(): Boolean {
        val me = ComponentName(this, MapsNotificationListener::class.java).flattenToString()
        val enabled = Settings.Secure.getString(contentResolver, "enabled_notification_listeners") ?: ""
        return enabled.split(':').any { it == me }
    }
}
