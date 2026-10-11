// Side service: thin adapter between the Android forwarder's local WebSocket,
// the Guidance core, and the watch. No navigation logic here.
import { BaseSideService } from '@zeppos/zml/base-side'
import { createGuidanceCore } from './guidance-core/index.js'

const FORWARDER_URL = 'ws://127.0.0.1:8786'
const RECONNECT_MS = 3000
// The Guidance core's sense of time passing without snapshots (e.g. "Arrived" timing out).
const TICK_MS = 1000

AppSideService(
  BaseSideService({
    onInit() {
      this.core = createGuidanceCore()
      this.currentView = null
      this.connect()
      this.tickTimer = setInterval(() => this.showOnWatch(this.core.tick(Date.now())), TICK_MS)
    },

    connect() {
      const socket = new WebSocket(FORWARDER_URL)
      this.socket = socket
      socket.onmessage = (event) => this.onSnapshot(event.data)
      socket.onclose = () => {
        if (this.destroyed) return
        this.reconnectTimer = setTimeout(() => this.connect(), RECONNECT_MS)
      }
      socket.onerror = () => {}
    },

    onSnapshot(data) {
      let snapshot
      try {
        snapshot = JSON.parse(data)
      } catch (e) {
        console.log('wristpilot: bad snapshot', data)
        return
      }
      this.showOnWatch(this.core.receive(snapshot, Date.now()))
    },

    showOnWatch({ view }) {
      if (!view) return
      this.currentView = view
      this.call({ method: 'turnCard.view', params: view })
    },

    onRequest(req, res) {
      if (req.method === 'turnCard.current') res(null, this.currentView)
      else res('unknown method')
    },

    onDestroy() {
      this.destroyed = true
      clearTimeout(this.reconnectTimer)
      clearInterval(this.tickTimer)
      if (this.socket) this.socket.close()
    },
  }),
)
