package dev.wristpilot.forwarder

import android.annotation.SuppressLint
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.PowerManager
import android.provider.Settings
import android.widget.Toast

/**
 * The phone setup that keeps HyperOS 2 from killing or freezing Wristpilot and Zepp during a
 * Navigation Session.
 * Each item says what to do, whether it's done when Android lets us check, and opens the right
 * settings page when there is one. HyperOS pages are tried first, then Android's own.
 */
object SetupChecklist {
    const val ZEPP = "com.huami.watch.hmwatchmanager"

    class Item(
        val title: String,
        val how: String,
        /** true / false when Android lets us check, null when it doesn't. */
        val done: (Context) -> Boolean?,
        val button: String? = null,
        val open: ((Activity) -> Unit)? = null,
    )

    val items = listOf(
        Item(
            "Allow restricted settings",
            "Only needed if Wristpilot is greyed out under notification access (installed from a " +
                "file rather than adb): App info → ⋮ → Allow restricted settings.",
            done = { if (hasNotificationAccess(it)) true else null },
            button = "Open Wristpilot's App info",
        ) { open(it, appInfo(it.packageName)) },
        Item(
            "Notification access for Wristpilot",
            "Switch on Wristpilot, so it can read Google Maps' navigation notification.",
            done = ::hasNotificationAccess,
            button = "Open notification access",
        ) { open(it, Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)) },
        Item(
            "Wristpilot may post notifications",
            "For \"Navigation started\" on the watch, and the notification that keeps Wristpilot " +
                "awake during navigation.",
            done = Notifications::allowed,
            button = "Open Wristpilot's notifications",
        ) {
            open(it, Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, it.packageName))
        },
        Item(
            "Autostart on for Wristpilot",
            "So Wristpilot starts listening by itself after a reboot, without being opened.",
            done = { null },
            button = "Open Autostart",
        ) {
            open(
                it,
                Intent().setComponent(
                    ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"),
                ),
                appInfo(it.packageName),
            )
        },
        Item(
            "Battery optimization off for Wristpilot",
            "Lets Android keep Wristpilot awake when navigation starts while the screen is off.",
            done = { ignoresBatteryOptimizations(it, it.packageName) },
            button = "Turn off battery optimization",
        ) { openBatteryOptimization(it) },
        Item(
            "Battery saver \"No restrictions\" for Wristpilot",
            "App info → Battery saver → No restrictions.",
            done = { null },
            button = "Open Wristpilot's battery saver",
        ) { open(it, batterySaver(it.packageName, "Wristpilot"), appInfo(it.packageName)) },
        Item(
            "Battery saver \"No restrictions\" for Zepp",
            "Zepp runs the watch's link to Wristpilot: App info → Battery saver → No restrictions.",
            done = { if (isInstalled(it, ZEPP)) null else false },
            button = "Open Zepp's battery saver",
        ) { open(it, batterySaver(ZEPP, "Zepp"), appInfo(ZEPP)) },
        Item(
            "Zepp sends Wristpilot's notifications to the watch",
            "In Zepp: Device → Active Max → Notifications and Reminders → Notifications → switch on " +
                "Wristpilot. Without it \"Navigation started\" never reaches the watch.",
            done = { if (isInstalled(it, ZEPP)) null else false },
            button = "Open Zepp",
        ) { activity ->
            activity.packageManager.getLaunchIntentForPackage(ZEPP)?.let { open(activity, it) }
                ?: Toast.makeText(activity, "Zepp is not installed", Toast.LENGTH_SHORT).show()
        },
        Item(
            "Lock Wristpilot and Zepp in Recents",
            "Open Recents, long-press each app's card and tap the lock, so clearing Recents never " +
                "closes them.",
            done = { null },
        ),
    )

    fun hasNotificationAccess(context: Context): Boolean {
        val me = ComponentName(context, MapsNotificationListener::class.java).flattenToString()
        val enabled = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners") ?: ""
        return enabled.split(':').any { it == me }
    }

    private fun ignoresBatteryOptimizations(context: Context, pkg: String): Boolean =
        context.getSystemService(PowerManager::class.java).isIgnoringBatteryOptimizations(pkg)

    private fun isInstalled(context: Context, pkg: String): Boolean = try {
        context.packageManager.getApplicationInfo(pkg, 0)
        true
    } catch (e: PackageManager.NameNotFoundException) {
        false
    }

    // Sideloaded, never on Play, so asking straight for the exemption is fine.
    @SuppressLint("BatteryLife")
    private fun openBatteryOptimization(activity: Activity) {
        open(
            activity,
            Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:${activity.packageName}")),
            Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS),
        )
    }

    private fun appInfo(pkg: String) =
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$pkg"))

    /** HyperOS's per-app battery saver page (MIUI's, still present on HyperOS 2). */
    private fun batterySaver(pkg: String, label: String) = Intent()
        .setComponent(ComponentName("com.miui.powerkeeper", "com.miui.powerkeeper.ui.HiddenAppsConfigActivity"))
        .putExtra("package_name", pkg)
        .putExtra("package_label", label)

    /** Opens the first of [intents] the phone can open. */
    private fun open(activity: Activity, vararg intents: Intent) {
        for (intent in intents) {
            try {
                activity.startActivity(intent)
                return
            } catch (e: ActivityNotFoundException) {
                // Try the next one.
            } catch (e: SecurityException) {
                // Not exported on this phone: try the next one.
            }
        }
        Toast.makeText(activity, "This phone has no such settings page", Toast.LENGTH_SHORT).show()
    }
}
