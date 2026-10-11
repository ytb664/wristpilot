// Side service: thin adapter between the Android forwarder's local WebSocket,
// the Guidance core, and the watch. No navigation logic here.
import { BaseSideService } from '@zeppos/zml/base-side'
import { createGuidanceCore } from './guidance-core/index.js'
import { arrowRects } from './arrow-rects.js'
import { createForwarderLink } from './forwarder-link.js'

const FORWARDER_URL = 'ws://127.0.0.1:8786'
// The Guidance core's sense of time passing without snapshots (e.g. "Arrived" timing out).
const TICK_MS = 1000
// During a Navigation Session the watch hears from us at least this often, so a quiet stretch on
// a long straight road doesn't look like lost contact. Well inside the watch's STALE_AFTER_MS.
const HEARTBEAT_MS = 2000

AppSideService(
  BaseSideService({
    onInit() {
      this.core = createGuidanceCore()
      this.forwarder = createForwarderLink({
        openSocket: () => new WebSocket(FORWARDER_URL),
        onSnapshot: (snapshot) => this.showOnWatch(this.core.receive(snapshot, Date.now())),
      })
      this.forwarder.start()
      this.lastSentAt = 0
      this.tickTimer = setInterval(() => this.tick(Date.now()), TICK_MS)
    },

    tick(now) {
      this.forwarder.check(now)
      this.showOnWatch(this.core.tick(now))
      // Only while the forwarder is heard from: without it guidance can't arrive, and the watch
      // should show the Stale Turn Card rather than trust the last Maneuver.
      // Only a Turn Card can go stale on the watch, so only a Turn Card needs the heartbeat.
      const view = this.core.current()
      const onTurn = view && view.screen === 'turn'
      if (onTurn && this.forwarder.isUp() && now - this.lastSentAt >= HEARTBEAT_MS) {
        this.callWatch({ method: 'turnCard.heartbeat' })
      }
    },

    callWatch(message) {
      this.lastSentAt = Date.now()
      this.call(message)
    },

    showOnWatch({ view, buzzes }) {
      if (view) this.callWatch({ method: 'turnCard.view', params: forWatch(view) })
      for (const buzz of buzzes) this.callWatch({ method: 'turnCard.buzz', params: { buzz } })
    },

    onRequest(req, res) {
      if (req.method === 'turnCard.current') res(null, forWatch(this.core.current()))
      else res('unknown method')
    },

    onDestroy() {
      clearInterval(this.tickTimer)
      this.forwarder.stop()
    },
  }),
)

// The watch draws the arrow as canvas rects; a view without an arrow key keeps the one shown.
function forWatch(view) {
  if (!view || !view.arrow) return view
  return { ...view, arrow: arrowRects(view.arrow) }
}
