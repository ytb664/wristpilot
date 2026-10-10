// Side service: thin adapter between the Android forwarder's local WebSocket,
// the Guidance core, and the watch. No navigation logic here.
import { BaseSideService } from '@zeppos/zml/base-side'
import { createGuidanceCore } from './guidance-core/index.js'

const FORWARDER_URL = 'ws://127.0.0.1:8786'
const RECONNECT_MS = 3000

AppSideService(
  BaseSideService({
    onInit() {
      this.core = createGuidanceCore()
      this.currentView = null
      this.connect()
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
      const { view } = this.core.receive(snapshot, Date.now())
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
      if (this.socket) this.socket.close()
    },
  }),
)
