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
import android.widget.TextView

/** One-screen status: is notification access granted, and is the watch link up. */
class MainActivity : Activity() {
    private val handler = Handler(Looper.getMainLooper())
    private lateinit var access: TextView
    private lateinit var link: TextView
    private lateinit var grant: Button

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
        setContentView(LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(pad, pad, pad, pad)
            addView(access)
            addView(link)
            addView(grant)
            addView(hint)
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
        val clients = MapsNotificationListener.server?.clientCount ?: 0
        link.text = when {
            !granted -> "✗ Watch link down (needs notification access)"
            clients > 0 -> "✓ Watch link up"
            else -> "… Waiting for Wristpilot on the watch to connect"
        }
    }

    private fun hasNotificationAccess(): Boolean {
        val me = ComponentName(this, MapsNotificationListener::class.java).flattenToString()
        val enabled = Settings.Secure.getString(contentResolver, "enabled_notification_listeners") ?: ""
        return enabled.split(':').any { it == me }
    }
}
