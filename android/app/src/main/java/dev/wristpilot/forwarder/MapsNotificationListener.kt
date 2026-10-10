package dev.wristpilot.forwarder

import android.service.notification.NotificationListenerService
import android.util.Log
import android.service.notification.StatusBarNotification

/** Forwards every Google Maps notification post and removal as a Raw Guidance Snapshot. */
class MapsNotificationListener : NotificationListenerService() {

    override fun onListenerConnected() {
        if (server == null) server = SnapshotServer().also { it.start() }
        activeNotifications?.filter(::isFromMaps)?.forEach { forward("posted", it) }
    }

    override fun onListenerDisconnected() {
        stopServer()
    }

    override fun onDestroy() {
        stopServer()
        super.onDestroy()
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        if (isFromMaps(sbn)) forward("posted", sbn)
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification) {
        if (isFromMaps(sbn)) forward("removed", sbn)
    }

    private fun isFromMaps(sbn: StatusBarNotification) = sbn.packageName == GOOGLE_MAPS

    private fun forward(event: String, sbn: StatusBarNotification) {
        val snapshot = RawGuidanceSnapshot.from(event, sbn, System.currentTimeMillis())
        // Lets the user check on the phone what Google Maps really sends (adb logcat -s WristpilotListener).
        Log.d(TAG, "$event category=${sbn.notification.category} ongoing=${sbn.isOngoing}")
        server?.forward(snapshot)
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

        @Volatile
        var server: SnapshotServer? = null
            private set
    }
}
