package dev.wristpilot.forwarder

import android.app.Notification
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.Drawable
import android.service.notification.StatusBarNotification
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject

/**
 * A Raw Guidance Snapshot: Google Maps' notification copied as-is, never interpreted.
 * The Guidance core in the Zepp side service does all the parsing.
 *
 * Format history (recorded drives keep whatever version they were made with):
 *  - v1: event, at, key, text extras, ongoing, category.
 *  - v2: adds `icon`, the notification's large icon (the Maneuver arrow), or null.
 *  - v3: adds `postedAt`, when Google Maps posted this update (null for removals). `at` is when
 *    the forwarder got it, which can be minutes later if HyperOS froze the forwarder meanwhile.
 */
object RawGuidanceSnapshot {
    const val FORMAT_VERSION = 3

    /** The large icon is downscaled to ICON_SIZE × ICON_SIZE pixels. */
    const val ICON_SIZE = 48

    fun from(context: Context, event: String, sbn: StatusBarNotification, at: Long): JSONObject {
        val n = sbn.notification
        val extras = n.extras
        val lines = JSONArray()
        extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)?.forEach { lines.put(it.toString()) }
        return JSONObject()
            .put("v", FORMAT_VERSION)
            .put("event", event)
            .put("at", at)
            .put("postedAt", if (event == "posted") sbn.postTime else JSONObject.NULL)
            .put("key", sbn.key)
            .put("title", extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: "")
            .put("text", extras.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: "")
            .put("bigText", extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString() ?: "")
            .put("subText", extras.getCharSequence(Notification.EXTRA_SUB_TEXT)?.toString() ?: "")
            .put("textLines", lines)
            .put("ongoing", sbn.isOngoing)
            .put("category", n.category ?: JSONObject.NULL)
            .put("icon", largeIcon(context, n)?.let(::encodeIcon) ?: JSONObject.NULL)
    }

    // getLargeIcon() also covers apps that set the large icon as a plain Bitmap.
    private fun largeIcon(context: Context, n: Notification): Drawable? = try {
        n.getLargeIcon()?.loadDrawable(context)
    } catch (e: Exception) {
        // A broken icon must never stop the text from being forwarded.
        null
    }

    /**
     * Encodes the icon as `{ w, h, format: "ga44", data }`: one byte per pixel, row by row,
     * high nibble = gray level (0 black … 15 white), low nibble = alpha (0 transparent … 15 opaque),
     * base64-encoded.
     */
    private fun encodeIcon(drawable: Drawable): JSONObject {
        val bitmap = Bitmap.createBitmap(ICON_SIZE, ICON_SIZE, Bitmap.Config.ARGB_8888)
        drawable.setBounds(0, 0, ICON_SIZE, ICON_SIZE)
        drawable.draw(Canvas(bitmap))
        val pixels = IntArray(ICON_SIZE * ICON_SIZE)
        bitmap.getPixels(pixels, 0, ICON_SIZE, 0, 0, ICON_SIZE, ICON_SIZE)
        bitmap.recycle()
        val bytes = ByteArray(pixels.size) { i ->
            val p = pixels[i]
            val a = p ushr 24
            val r = (p shr 16) and 0xff
            val g = (p shr 8) and 0xff
            val b = p and 0xff
            // getPixels() returns non-premultiplied colours, so this is the drawn colour's gray.
            val gray = (299 * r + 587 * g + 114 * b) / 1000
            ((gray shr 4 shl 4) or (a shr 4)).toByte()
        }
        return JSONObject()
            .put("w", ICON_SIZE)
            .put("h", ICON_SIZE)
            .put("format", "ga44")
            .put("data", Base64.encodeToString(bytes, Base64.NO_WRAP))
    }
}
