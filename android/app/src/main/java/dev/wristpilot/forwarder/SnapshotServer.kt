package dev.wristpilot.forwarder

import android.util.Log
import org.java_websocket.WebSocket
import org.java_websocket.handshake.ClientHandshake
import org.java_websocket.server.WebSocketServer
import org.json.JSONObject
import java.net.InetSocketAddress

/**
 * Local WebSocket server the Zepp side service connects to (ws://127.0.0.1:[PORT]).
 * Broadcasts every snapshot; a newly connected client first gets the latest snapshot
 * of each Google Maps notification still showing, so it can pick up mid-session.
 */
class SnapshotServer(
    /** Called (on the server's thread) if the port can't be bound; this instance is then dead. */
    private val onFailed: () -> Unit,
) : WebSocketServer(InetSocketAddress("127.0.0.1", PORT)) {
    /** Latest snapshot JSON of each Google Maps notification still showing, by notification key. */
    private val latestByKey = LinkedHashMap<String, String>()

    /** False until the port is bound, and again if binding fails. */
    @Volatile
    var isRunning = false
        private set

    /** True once binding the port has failed. */
    @Volatile
    var hasFailed = false
        private set

    init {
        isReuseAddr = true
    }

    fun forward(snapshot: JSONObject) {
        val json = snapshot.toString()
        // Broadcast under the lock so a client connecting meanwhile never gets a stale replay.
        synchronized(latestByKey) {
            val key = snapshot.getString("key")
            if (snapshot.getString("event") == "removed") latestByKey.remove(key) else latestByKey[key] = json
            broadcast(json)
        }
    }

    val clientCount: Int get() = connections.size

    override fun onOpen(conn: WebSocket, handshake: ClientHandshake) {
        Log.i(TAG, "side service connected")
        synchronized(latestByKey) { latestByKey.values.forEach(conn::send) }
    }

    override fun onClose(conn: WebSocket, code: Int, reason: String?, remote: Boolean) {
        Log.i(TAG, "side service disconnected")
    }

    override fun onMessage(conn: WebSocket, message: String) {}

    override fun onError(conn: WebSocket?, ex: Exception) {
        Log.w(TAG, "websocket error", ex)
        // conn == null means the server itself failed (e.g. the port is taken).
        if (conn == null && !hasFailed) {
            isRunning = false
            hasFailed = true
            onFailed()
        }
    }

    override fun onStart() {
        isRunning = true
        Log.i(TAG, "listening on 127.0.0.1:$PORT")
    }

    companion object {
        const val PORT = 8786
        private const val TAG = "WristpilotServer"
    }
}
