package dev.wristpilot.forwarder

import android.app.Notification
import android.service.notification.StatusBarNotification
import org.json.JSONArray
import org.json.JSONObject

/**
 * A Raw Guidance Snapshot: Google Maps' notification copied as-is, never interpreted.
 * The Guidance core in the Zepp side service does all the parsing.
 */
object RawGuidanceSnapshot {
    const val FORMAT_VERSION = 1

    fun from(event: String, sbn: StatusBarNotification, at: Long): JSONObject {
        val n = sbn.notification
        val extras = n.extras
        val lines = JSONArray()
        extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)?.forEach { lines.put(it.toString()) }
        return JSONObject()
            .put("v", FORMAT_VERSION)
            .put("event", event)
            .put("at", at)
            .put("key", sbn.key)
            .put("title", extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: "")
            .put("text", extras.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: "")
            .put("bigText", extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString() ?: "")
            .put("subText", extras.getCharSequence(Notification.EXTRA_SUB_TEXT)?.toString() ?: "")
            .put("textLines", lines)
            .put("ongoing", sbn.isOngoing)
            .put("category", n.category ?: JSONObject.NULL)
    }
}
