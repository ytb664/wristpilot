package dev.wristpilot.forwarder

import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.io.OutputStreamWriter
import java.io.Writer
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.Executors

/**
 * Drive Recordings: while "Record drive" is on, every Raw Guidance Snapshot is appended to one
 * file, one JSON snapshot per line (JSON Lines). Each time recording is switched on a new file
 * starts; the user switches it on before a drive and off after it. These files become the
 * Guidance core's test fixtures.
 *
 * The switch is remembered, so if HyperOS kills and restarts the forwarder mid-drive, recording
 * carries on in a new file.
 */
object DriveRecorder {
    private const val TAG = "WristpilotRecorder"
    private const val PREFS = "drive_recorder"
    private const val KEY_ON = "recording"

    /** Writes happen off the main thread, in order. */
    private val io = Executors.newSingleThreadExecutor()
    private var writer: Writer? = null

    fun dir(context: Context): File =
        File(context.getExternalFilesDir(null) ?: context.filesDir, "recordings").apply { mkdirs() }

    fun isOn(context: Context): Boolean = prefs(context).getBoolean(KEY_ON, false)

    fun setOn(context: Context, on: Boolean) {
        prefs(context).edit().putBoolean(KEY_ON, on).apply()
        // The next snapshot opens a fresh file; switching off closes the current one.
        io.execute { closeFile() }
    }

    /** Recordings on the phone, newest first. */
    fun recordings(context: Context): List<File> =
        dir(context).listFiles { f -> f.name.endsWith(".jsonl") }.orEmpty().sortedByDescending { it.name }

    fun record(context: Context, snapshot: JSONObject) {
        if (!isOn(context)) return
        val line = snapshot.toString()
        val app = context.applicationContext
        io.execute {
            try {
                val w = writer ?: open(newFile(app)).also { writer = it }
                w.write(line)
                w.write("\n")
                // Flush every line: the process may be killed at any moment.
                w.flush()
            } catch (e: Exception) {
                Log.w(TAG, "could not record snapshot", e)
                closeFile()
            }
        }
    }

    /** A chooser that hands [file] to another app (Drive, Telegram, email…). */
    fun shareIntent(context: Context, file: File): Intent {
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.recordings", file)
        val send = Intent(Intent.ACTION_SEND)
            .setType("text/plain")
            .putExtra(Intent.EXTRA_STREAM, uri)
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        return Intent.createChooser(send, "Share ${file.name}")
    }

    // Append, so a second file opened within the same second never erases the first.
    private fun open(file: File): Writer = OutputStreamWriter(FileOutputStream(file, true), Charsets.UTF_8)

    private fun newFile(context: Context): File {
        val stamp = SimpleDateFormat("yyyyMMdd-HHmmss", Locale.US).format(Date())
        return File(dir(context), "drive-$stamp.jsonl").also { Log.i(TAG, "recording to $it") }
    }

    private fun closeFile() {
        try {
            writer?.close()
        } catch (e: Exception) {
            Log.w(TAG, "could not close recording", e)
        }
        writer = null
    }

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
