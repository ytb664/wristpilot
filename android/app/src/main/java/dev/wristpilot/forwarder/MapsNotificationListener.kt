package dev.wristpilot.forwarder

import android.os.Handler
import android.os.Looper
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log

/** Forwards every Google Maps notification post and removal as a Raw Guidance Snapshot. */
class MapsNotificationListener : NotificationListenerService() {
    private val handler = Handler(Looper.getMainLooper())

    override fun onListenerConnected() {
        Log.i(TAG, "listener connected")
        if (server == null) startServer()
        activeNotifications?.filter(::isFromMaps)?.forEach { forward("posted", it) }
    }

    override fun onListenerDisconnected() {
        Log.i(TAG, "listener disconnected")
        handler.removeCallbacksAndMessages(null)
        stopServer()
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        stopServer()
        super.onDestroy()
    }

    private fun startServer() {
        lateinit var started: SnapshotServer
        started = SnapshotServer(onFailed = {
            // A WebSocketServer can't be started twice: try a fresh one in a moment.
            handler.postDelayed({
                if (server === started) {
                    server = null
                    startServer()
                }
            }, RETRY_MS)
        })
        server = started
        started.start()
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        if (isFromMaps(sbn)) forward("posted", sbn)
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification) {
        if (isFromMaps(sbn)) forward("removed", sbn)
    }

    private fun isFromMaps(sbn: StatusBarNotification) = sbn.packageName == GOOGLE_MAPS

    private fun forward(event: String, sbn: StatusBarNotification) {
        // An exception here would crash the listener and silently stop all guidance.
        try {
            val snapshot = RawGuidanceSnapshot.from(this, event, sbn, System.currentTimeMillis())
            // Lets the user check on the phone what Google Maps really sends (adb logcat -s WristpilotListener).
            Log.d(TAG, "$event category=${sbn.notification.category} ongoing=${sbn.isOngoing} " +
                "icon=${!snapshot.isNull("icon")} title=${snapshot.getString("title")}")
            DriveRecorder.record(this, snapshot)
            server?.forward(snapshot)
            lastForwarded = LastForwarded(snapshot.getLong("at"), event, snapshot.getString("title"), snapshot.getString("text"))
            forwardedCount++
        } catch (e: Exception) {
            Log.e(TAG, "could not forward $event", e)
        }
    }

    private fun stopServer() {
        val stopping = server ?: return
        server = null
        // stop() blocks while closing connections; keep it off the main thread.
        Thread { stopping.stop(500) }.start()
    }

    companion object {
        const val GOOGLE_MAPS = "com.google.android.apps.maps"
        private const val TAG = "WristpilotListener"
        private const val RETRY_MS = 3000L

        @Volatile
        var server: SnapshotServer? = null
            private set

        /** The last Google Maps post or removal forwarded, shown on the phone screen. */
        @Volatile
        var lastForwarded: LastForwarded? = null
            private set

        /** Google Maps posts and removals forwarded since the forwarder started. */
        @Volatile
        var forwardedCount = 0
            private set
    }

    class LastForwarded(val at: Long, val event: String, val title: String, val text: String)
}
