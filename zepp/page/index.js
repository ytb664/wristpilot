// Turn Card page. Renders whatever Turn Card View the side service sends; no parsing here.
import * as hmUI from '@zos/ui'
import { getDeviceInfo } from '@zos/device'
import { Vibrator } from '@zos/sensor'
import {
  setPageBrightTime,
  resetPageBrightTime,
  pauseDropWristScreenOff,
  resetDropWristScreenOff,
  pausePalmScreenOff,
  resetPalmScreenOff,
  setWakeUpRelaunch,
} from '@zos/display'
import { onGesture, offGesture, GESTURE_RIGHT } from '@zos/interaction'
import { BasePage } from '@zeppos/zml/base-page'
import { createStaleTimer } from './stale-timer.js'
import { arrowDrawRects } from './arrow-canvas.js'

const { width: WIDTH, height: HEIGHT } = getDeviceInfo()
// The screens that show a message instead of the Turn Card.
const MESSAGES = {
  waiting: { text: 'Waiting for Google Maps', text_size: 40 },
  arrived: { text: 'Arrived', text_size: 72 },
}

const WHITE = 0xffffff
const GREY = 0xaaaaaa
// The Stale Turn Card: everything dimmed to this share of its brightness, plus a "disconnected" mark.
const STALE_DIM = 0.35
const STALE_MARK_COLOR = 0xff5040
// How often the page checks whether the Turn Card has gone stale.
const STALE_CHECK_MS = 1000
// A Turn Card stale this long gives up keeping the screen on: the Navigation Session may have
// ended on the phone without the watch hearing of it. The next message turns it back on.
const STALE_GIVE_UP_MS = 10 * 60 * 1000
// setPageBrightTime's longest bright time (about 24 days): the whole Navigation Session.
const BRIGHT_FOR_SESSION_MS = 2147483000

// Turn Card layout on the round 480×480 screen, top to bottom. Each row is narrowed to stay
// inside the circle at its lowest edge. Google Maps' arrow is drawn 1:1 from the forwarder's
// 120×120 bitmap (RawGuidanceSnapshot.ICON_SIZE); without one, the instruction takes its place.
const ARROW = { x: WIDTH / 2 - 60, y: 52, w: 120, h: 120 }
const INSTRUCTION = { x: 100, y: 52, w: WIDTH - 200, h: 120, text_size: 36, color: WHITE }
const DISTANCE = { x: 40, y: 185, w: WIDTH - 80, h: 110, text_size: 96, color: WHITE }
const STREET = { x: 40, y: 295, w: WIDTH - 80, h: 56, text_size: 44, color: WHITE }
const TRIP_LINE = { x: 80, y: 365, w: WIDTH - 160, h: 40, text_size: 30, color: GREY }
const STALE_MARK = { x: 130, y: 412, w: WIDTH - 260, h: 36, text_size: 28, color: STALE_MARK_COLOR }

Page(
  BasePage({
    build() {
      this.vibrator = new Vibrator()
      // One short buzz for a new Maneuver, two for the Turn-Now Alert (step patterns: API 3.6).
      // Named scenes like URGENT may be patterns of their own, so both use the plain short buzz.
      const type = this.vibrator.getType()
      const short = { type: type.STRONG_SHORT }
      this.buzzSteps = {
        newManeuver: [short],
        turnNow: [short, { type: type.PAUSE, duration: 150 }, short],
      }
      this.arrow = hmUI.createWidget(hmUI.widget.CANVAS, ARROW)
      this.hasArrow = false
      // False until the page has been told an arrow (or none): views leave out an unchanged one.
      this.knowsArrow = false
      this.instruction = hmUI.createWidget(hmUI.widget.TEXT, {
        ...INSTRUCTION,
        align_h: hmUI.align.CENTER_H,
        align_v: hmUI.align.CENTER_V,
        text_style: hmUI.text_style.WRAP,
        text: '',
      })
      this.turnCard = [
        (this.distance = line(DISTANCE)),
        (this.street = line(STREET)),
        (this.tripLine = line(TRIP_LINE)),
      ]
      // Text widgets dimmed on the Stale Turn Card, with their normal colours.
      this.dimmable = [
        [this.instruction, INSTRUCTION.color],
        [this.distance, DISTANCE.color],
        [this.street, STREET.color],
        [this.tripLine, TRIP_LINE.color],
      ]
      this.staleMark = line(STALE_MARK)
      this.staleMark.setProperty(hmUI.prop.TEXT, 'Disconnected')
      this.staleMark.setProperty(hmUI.prop.VISIBLE, false)
      this.showsStale = false
      this.staleTimer = createStaleTimer()
      this.staleCheck = setInterval(() => this.checkStale(), STALE_CHECK_MS)
      this.awake = false
      // Relaunch-on-wake outlives the page (see onDestroy), so it starts off and comes on only
      // with a Turn Card: reopened outside a Navigation Session (e.g. after the button closed
      // Wristpilot mid-session), waking the watch shows the watch face again.
      setWakeUpRelaunch({ relaunch: false })
      // A stray swipe mustn't close the Turn Card during a Navigation Session; the button still leaves.
      onGesture({ callback: (event) => this.awake && event === GESTURE_RIGHT })
      // The Waiting Screen and "Arrived".
      this.message = hmUI.createWidget(hmUI.widget.TEXT, {
        x: 40,
        y: 0,
        w: WIDTH - 80,
        h: HEIGHT,
        color: WHITE,
        align_h: hmUI.align.CENTER_H,
        align_v: hmUI.align.CENTER_V,
        text_style: hmUI.text_style.WRAP,
        ...MESSAGES.waiting,
      })
      this.show({ screen: 'waiting' })
      // The page may open mid-Navigation Session: ask for the current view.
      this.askForCurrent()
    },

    askForCurrent() {
      this.request({ method: 'turnCard.current' })
        .then((view) => {
          this.heard()
          this.show(view)
        })
        .catch(() => {})
    },

    onCall({ method, params }) {
      this.heard()
      if (method === 'turnCard.view') this.show(params)
      else if (method === 'turnCard.buzz') this.buzz(params.buzz)
      // turnCard.heartbeat only says the Navigation Phone is still there.
    },

    // Any message from the side service. After a silence, views may have been lost (and with
    // them a new arrow, which views leave out once sent), so ask for the full Turn Card.
    heard() {
      if (!this.staleTimer.heard(Date.now())) return
      this.setStale(false)
      this.askForCurrent()
    },

    checkStale() {
      const now = Date.now()
      this.setStale(this.onTurn && this.staleTimer.isStale(now))
      if (this.showsStale && now - this.staleSince >= STALE_GIVE_UP_MS) this.keepAwake(false)
    },

    // The Stale Turn Card is the Turn Card dimmed, with the "disconnected" mark.
    setStale(stale) {
      if (stale === this.showsStale) return
      this.showsStale = stale
      if (stale) this.staleSince = Date.now()
      for (const [widget, color] of this.dimmable) {
        widget.setProperty(hmUI.prop.COLOR, stale ? dim(color) : color)
      }
      this.drawArrow(this.arrowShown)
      this.staleMark.setProperty(hmUI.prop.VISIBLE, stale)
    },

    // During a Navigation Session the screen stays on and Wristpilot stays open: no timeout,
    // no wrist-drop or palm-cover screen-off, and if the screen goes off anyway, waking the
    // watch reopens Wristpilot instead of the watch face. Normal behaviour returns after.
    keepAwake(awake) {
      if (awake === this.awake) return
      this.awake = awake
      if (awake) {
        setPageBrightTime({ brightTime: BRIGHT_FOR_SESSION_MS })
        pauseDropWristScreenOff({ duration: 0 })
        pausePalmScreenOff({ duration: 0 })
      } else {
        restoreScreenOff()
      }
      setWakeUpRelaunch({ relaunch: awake })
    },

    // Buzz commands from the Guidance core, played with the step patterns from build().
    buzz(buzz) {
      const steps = this.buzzSteps[buzz]
      if (!steps) return
      this.vibrator.stop()
      this.vibrator.start(steps)
    },

    onDestroy() {
      this.vibrator.stop()
      clearInterval(this.staleCheck)
      offGesture()
      // Relaunch-on-wake is left as it is: the system closing Wristpilot while the screen is
      // off also destroys the page, and waking the watch must still reopen it.
      if (this.awake) restoreScreenOff()
    },

    // Google Maps' arrow as rects from the side service: { w, h, rects: [x, y, w, h, level, ...] },
    // or null for none. Drawn once per new arrow; re-posts with the same arrow don't resend it.
    drawArrow(arrow) {
      this.arrow.clear({ x: 0, y: 0, w: ARROW.w, h: ARROW.h })
      this.arrowShown = arrow
      this.hasArrow = !!arrow
      if (!arrow) return
      const brightness = this.showsStale ? STALE_DIM : 1
      const left = Math.round((ARROW.w - arrow.w) / 2)
      const top = Math.round((ARROW.h - arrow.h) / 2)
      for (const rect of arrowDrawRects(arrow, { left, top, brightness })) this.arrow.drawRect(rect)
    },

    show(view) {
      // No view yet: keep what's on screen.
      if (!view) return
      const onTurn = view.screen === 'turn'
      // No arrow key: the arrow on the watch is still Google Maps' current one. If this page
      // never got one (a view raced ahead of the turnCard.current reply), ask for it.
      if ('arrow' in view) {
        this.knowsArrow = true
        this.drawArrow(view.arrow)
      } else if (onTurn && !this.knowsArrow) this.askForCurrent()
      this.onTurn = onTurn
      this.keepAwake(onTurn)
      if (!onTurn) this.setStale(false)
      for (const widget of this.turnCard) widget.setProperty(hmUI.prop.VISIBLE, onTurn)
      this.arrow.setProperty(hmUI.prop.VISIBLE, onTurn && this.hasArrow)
      this.instruction.setProperty(hmUI.prop.VISIBLE, onTurn && !this.hasArrow)
      this.message.setProperty(hmUI.prop.VISIBLE, !onTurn)
      if (!onTurn) {
        this.message.setProperty(hmUI.prop.MORE, MESSAGES[view.screen] || MESSAGES.waiting)
        return
      }
      this.instruction.setProperty(hmUI.prop.TEXT, view.instruction)
      this.distance.setProperty(hmUI.prop.TEXT, view.distance)
      this.street.setProperty(hmUI.prop.TEXT, view.street)
      this.tripLine.setProperty(hmUI.prop.TEXT, view.tripLine)
    },
  }),
)

function restoreScreenOff() {
  resetPageBrightTime()
  resetDropWristScreenOff()
  resetPalmScreenOff()
}

function dim(color) {
  const channel = (shift) => Math.round(((color >> shift) & 0xff) * STALE_DIM) << shift
  return channel(16) | channel(8) | channel(0)
}

// One centred line that ends in "…" when it doesn't fit.
function line(box) {
  return hmUI.createWidget(hmUI.widget.TEXT, {
    ...box,
    align_h: hmUI.align.CENTER_H,
    align_v: hmUI.align.CENTER_V,
    text_style: hmUI.text_style.ELLIPSIS,
    text: '',
  })
}
