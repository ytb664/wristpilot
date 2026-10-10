package dev.wristpilot.forwarder

import android.service.notification.NotificationListenerService
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
        server?.forward(RawGuidanceSnapshot.from(event, sbn, System.currentTimeMillis()))
    }

    private fun stopServer() {
        server?.stop(500)
        server = null
    }

    companion object {
        const val GOOGLE_MAPS = "com.google.android.apps.maps"

        @Volatile
        var server: SnapshotServer? = null
            private set
    }
}
