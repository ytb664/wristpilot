package dev.wristpilot.forwarder

import android.annotation.SuppressLint
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat

/**
 * Keeps the forwarder from being frozen while a Navigation Session runs: a foreground service
 * plus a partial wake lock, for as long as Google Maps shows its navigation notification.
 * Without it HyperOS froze the forwarder 1 minute into a session and held back 12 minutes of
 * Google Maps updates (ticket 02).
 *
 * It holds no logic of its own: [MapsNotificationListener] starts and stops it.
 */
class NavigationSessionService : Service() {
    private var wakeLock: PowerManager.WakeLock? = null

    // The Navigation Phone runs Android 15; older phones just get the type's bit stored.
    @SuppressLint("InlinedApi")
    override fun onCreate() {
        super.onCreate()
        ServiceCompat.startForeground(
            this,
            Notifications.KEEP_AWAKE_ID,
            Notifications.keepAwake(this),
            ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE,
        )
        wakeLock = (getSystemService(Context.POWER_SERVICE) as PowerManager)
            .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Wristpilot:NavigationSession")
            .apply { acquire(WAKE_LOCK_MAX_MS) }
        isRunning = true
        Log.i(TAG, "keeping the forwarder awake")
    }

    // Not sticky: if Android kills it, the listener starts it again with the next Google Maps update.
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int) = START_NOT_STICKY

    override fun onDestroy() {
        isRunning = false
        wakeLock?.let { if (it.isHeld) it.release() }
        wakeLock = null
        Log.i(TAG, "no longer keeping the forwarder awake")
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        private const val TAG = "WristpilotSession"

        /** A safety net: a session's wake lock never outlives a very long drive. */
        private const val WAKE_LOCK_MAX_MS = 6 * 60 * 60 * 1000L

        @Volatile
        var isRunning = false
            private set

        /** Why the last start failed, shown on the phone screen; null once a start works. */
        @Volatile
        var startError: String? = null
            private set

        fun start(context: Context) {
            try {
                ContextCompat.startForegroundService(context, Intent(context, NavigationSessionService::class.java))
                startError = null
            } catch (e: Exception) {
                // Android 12+ refuses foreground services started from the background unless
                // battery optimization is off for Wristpilot (ForegroundServiceStartNotAllowedException).
                Log.e(TAG, "could not keep the forwarder awake", e)
                startError = e.javaClass.simpleName
            }
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, NavigationSessionService::class.java))
        }
    }
}
