package dev.wristpilot.forwarder

import android.util.Log
import org.java_websocket.WebSocket
import org.java_websocket.handshake.ClientHandshake
import org.java_websocket.server.WebSocketServer
import org.json.JSONObject
import java.net.InetSocketAddress

/**
 * Local WebSocket server the Zepp side service connects to (ws://127.0.0.1:8786).
 * Broadcasts every snapshot; a newly connected client first gets the latest snapshot
 * of each Google Maps notification still showing, so it can pick up mid-session.
 */
class SnapshotServer : WebSocketServer(InetSocketAddress("127.0.0.1", PORT)) {
    private val showing = LinkedHashMap<String, String>()

    init {
        isReuseAddr = true
    }

    fun forward(snapshot: JSONObject) {
        val json = snapshot.toString()
        synchronized(showing) {
            val key = snapshot.getString("key")
            if (snapshot.getString("event") == "removed") showing.remove(key) else showing[key] = json
        }
        broadcast(json)
    }

    val clientCount: Int get() = connections.size

    override fun onOpen(conn: WebSocket, handshake: ClientHandshake) {
        Log.i(TAG, "side service connected")
        synchronized(showing) { showing.values.forEach(conn::send) }
    }

    override fun onClose(conn: WebSocket, code: Int, reason: String?, remote: Boolean) {
        Log.i(TAG, "side service disconnected")
    }

    override fun onMessage(conn: WebSocket, message: String) {}

    override fun onError(conn: WebSocket?, ex: Exception) {
        Log.w(TAG, "websocket error", ex)
    }

    override fun onStart() {
        Log.i(TAG, "listening on 127.0.0.1:$PORT")
    }

    companion object {
        const val PORT = 8786
        private const val TAG = "WristpilotServer"
    }
}
