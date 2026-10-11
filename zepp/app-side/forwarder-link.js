// The side service's link to the Android forwarder's local WebSocket. It reconnects by itself
// after any drop, and treats a forwarder that falls silent as down: HyperOS can freeze the
// forwarder with the socket still open, and then only the missing heartbeats tell.
//
// The forwarder sends a heartbeat ({ heartbeat }) every 2 s besides its Raw Guidance Snapshots.
// Snapshots go to onSnapshot; heartbeats only prove the link. Call check(now) every second or so.

export const RECONNECT_MS = 3000
// Three missed forwarder heartbeats.
export const SILENT_AFTER_MS = 6000

export function createForwarderLink({
  openSocket,
  onSnapshot,
  now = Date.now,
  later = setTimeout,
  cancel = clearTimeout,
}) {
  let socket = null
  let lastHeard = null // null: nothing heard on this socket yet
  let openedAt = null
  let reconnectTimer = null
  let stopped = false

  function connect() {
    reconnectTimer = null
    lastHeard = null
    openedAt = now()
    let opened
    try {
      opened = openSocket()
    } catch (e) {
      socket = null
      reconnectLater()
      return
    }
    socket = opened
    // Every handler checks it still belongs to the current socket: one given up on may still
    // fire events later.
    const heard = () => {
      if (socket === opened) lastHeard = now()
    }
    opened.onopen = heard
    opened.onmessage = (event) => {
      if (socket !== opened) return
      heard()
      let message
      try {
        message = JSON.parse(event.data)
      } catch (e) {
        console.log('wristpilot: bad message from the forwarder', event.data)
        return
      }
      if (message && message.event) onSnapshot(message)
    }
    opened.onclose = () => {
      if (socket === opened) drop()
    }
    opened.onerror = () => {}
  }

  function drop() {
    const old = socket
    socket = null
    lastHeard = null
    if (old) {
      try {
        old.close()
      } catch (e) {}
    }
    reconnectLater()
  }

  function reconnectLater() {
    if (stopped || reconnectTimer !== null) return
    reconnectTimer = later(connect, RECONNECT_MS)
  }

  return {
    start() {
      connect()
    },

    // True while the forwarder has been heard from recently on the current socket.
    isUp() {
      return lastHeard !== null
    },

    check(time) {
      // An attempt that never opens counts as silence from when it started.
      if (socket && time - (lastHeard !== null ? lastHeard : openedAt) >= SILENT_AFTER_MS) {
        console.log('wristpilot: forwarder silent, reconnecting')
        drop()
      }
    },

    stop() {
      stopped = true
      if (reconnectTimer !== null) cancel(reconnectTimer)
      reconnectTimer = null
      const old = socket
      socket = null
      lastHeard = null
      if (old) old.close()
    },
  }
}
