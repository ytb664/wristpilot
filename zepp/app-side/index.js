// Side service: thin adapter between the Android forwarder's local WebSocket,
// the Guidance core, and the watch. No navigation logic here.
import { BaseSideService } from '@zeppos/zml/base-side'
import { createGuidanceCore } from './guidance-core/index.js'
import { arrowRects } from './arrow-rects.js'

const FORWARDER_URL = 'ws://127.0.0.1:8786'
const RECONNECT_MS = 3000
// The Guidance core's sense of time passing without snapshots (e.g. "Arrived" timing out).
const TICK_MS = 1000
// During a Navigation Session the watch hears from us at least this often, so a quiet stretch on
// a long straight road doesn't look like lost contact. Well inside the watch's STALE_AFTER_MS.
const HEARTBEAT_MS = 2000

AppSideService(
  BaseSideService({
    onInit() {
      this.core = createGuidanceCore()
      this.connect()
      this.lastSentAt = 0
      this.tickTimer = setInterval(() => this.tick(Date.now()), TICK_MS)
    },

    tick(now) {
      this.showOnWatch(this.core.tick(now))
      // Only while the forwarder is connected: without it guidance can't arrive, and the watch
      // should show the Stale Turn Card rather than trust the last Maneuver.
      const view = this.core.current()
      const inSession = view && view.screen !== 'waiting'
      if (inSession && this.forwarderUp && now - this.lastSentAt >= HEARTBEAT_MS) {
        this.send({ method: 'turnCard.heartbeat' })
      }
    },

    send(message) {
      this.lastSentAt = Date.now()
      this.call(message)
    },

    connect() {
      const socket = new WebSocket(FORWARDER_URL)
      this.socket = socket
      // A snapshot also proves the link, in case this runtime never fires onopen.
      socket.onopen = () => (this.forwarderUp = true)
      socket.onmessage = (event) => {
        this.forwarderUp = true
        this.onSnapshot(event.data)
      }
      socket.onclose = () => {
        this.forwarderUp = false
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

    showOnWatch({ view, buzzes }) {
      if (view) this.send({ method: 'turnCard.view', params: forWatch(view) })
      for (const buzz of buzzes) this.send({ method: 'turnCard.buzz', params: { buzz } })
    },

    onRequest(req, res) {
      if (req.method === 'turnCard.current') res(null, forWatch(this.core.current()))
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

// The watch draws the arrow as canvas rects; a view without an arrow key keeps the one shown.
function forWatch(view) {
  if (!view || !view.arrow) return view
  return { ...view, arrow: arrowRects(view.arrow) }
}
