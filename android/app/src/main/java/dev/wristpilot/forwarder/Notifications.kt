package dev.wristpilot.forwarder

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

/**
 * The forwarder's own phone notifications:
 *  - "Navigation started", posted once per Navigation Session. Zepp mirrors it to the watch as a
 *    reminder to open Wristpilot there (if Wristpilot is switched on in Zepp's notification list).
 *  - The quiet ongoing notification Android requires while [NavigationSessionService] runs.
 */
object Notifications {
    const val KEEP_AWAKE_ID = 1
    private const val NAVIGATION_STARTED_ID = 2
    private const val KEEP_AWAKE_CHANNEL = "keep_awake"
    private const val NAVIGATION_STARTED_CHANNEL = "navigation_started"

    fun keepAwake(context: Context): Notification {
        createChannels(context)
        return NotificationCompat.Builder(context, KEEP_AWAKE_CHANNEL)
            .setSmallIcon(android.R.drawable.ic_menu_directions)
            .setContentTitle("Forwarding Google Maps to the watch")
            .setContentText("Until the Navigation Session ends")
            .setContentIntent(openForwarder(context))
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    fun postNavigationStarted(context: Context) {
        createChannels(context)
        val notification = NotificationCompat.Builder(context, NAVIGATION_STARTED_CHANNEL)
            .setSmallIcon(android.R.drawable.ic_menu_directions)
            .setContentTitle("Navigation started")
            .setContentText("Open Wristpilot on the watch")
            .setContentIntent(openForwarder(context))
            .setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .build()
        try {
            NotificationManagerCompat.from(context).notify(NAVIGATION_STARTED_ID, notification)
        } catch (e: SecurityException) {
            // Notifications not allowed (Android 13+): the setup checklist on the phone screen says so.
        }
    }

    fun cancelNavigationStarted(context: Context) {
        NotificationManagerCompat.from(context).cancel(NAVIGATION_STARTED_ID)
    }

    fun allowed(context: Context): Boolean = NotificationManagerCompat.from(context).areNotificationsEnabled()

    private fun openForwarder(context: Context): PendingIntent = PendingIntent.getActivity(
        context,
        0,
        Intent(context, MainActivity::class.java),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )

    private fun createChannels(context: Context) {
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(KEEP_AWAKE_CHANNEL, "Keeping awake during navigation", NotificationManager.IMPORTANCE_LOW),
        )
        manager.createNotificationChannel(
            NotificationChannel(NAVIGATION_STARTED_CHANNEL, "Navigation started", NotificationManager.IMPORTANCE_DEFAULT),
        )
    }
}
