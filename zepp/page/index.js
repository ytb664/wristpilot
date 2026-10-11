// Turn Card page. Renders whatever Turn Card View the side service sends; no parsing here.
import * as hmUI from '@zos/ui'
import { getDeviceInfo } from '@zos/device'
import { BasePage } from '@zeppos/zml/base-page'

const { width: WIDTH, height: HEIGHT } = getDeviceInfo()
// The screens that show a message instead of the Turn Card.
const MESSAGES = {
  waiting: { text: 'Waiting for Google Maps', text_size: 40 },
  arrived: { text: 'Arrived', text_size: 72 },
}

const WHITE = 0xffffff
const GREY = 0xaaaaaa

// Turn Card layout on the round 480×480 screen, top to bottom. Each row is narrowed to stay
// inside the circle at its lowest edge. Google Maps' arrow is drawn 1:1 from the forwarder's
// 120×120 bitmap (RawGuidanceSnapshot.ICON_SIZE); without one, the instruction takes its place.
const ARROW = { x: WIDTH / 2 - 60, y: 52, w: 120, h: 120 }
const INSTRUCTION = { x: 100, y: 52, w: WIDTH - 200, h: 120, text_size: 36, color: WHITE }
const DISTANCE = { x: 40, y: 185, w: WIDTH - 80, h: 110, text_size: 96, color: WHITE }
const STREET = { x: 40, y: 295, w: WIDTH - 80, h: 56, text_size: 44, color: WHITE }
const TRIP_LINE = { x: 80, y: 365, w: WIDTH - 160, h: 40, text_size: 30, color: GREY }

Page(
  BasePage({
    build() {
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
        .then((view) => this.show(view))
        .catch(() => {})
    },

    onCall({ method, params }) {
      if (method === 'turnCard.view') this.show(params)
    },

    // Google Maps' arrow as rects from the side service: { w, h, rects: [x, y, w, h, level, ...] },
    // or null for none. Drawn once per new arrow; re-posts with the same arrow don't resend it.
    drawArrow(arrow) {
      this.arrow.clear({ x: 0, y: 0, w: ARROW.w, h: ARROW.h })
      this.knowsArrow = true
      this.hasArrow = !!arrow
      if (!arrow) return
      const left = Math.round((ARROW.w - arrow.w) / 2)
      const top = Math.round((ARROW.h - arrow.h) / 2)
      const { rects } = arrow
      for (let i = 0; i < rects.length; i += 5) {
        this.arrow.drawRect({
          x: left + rects[i],
          y: top + rects[i + 1],
          w: rects[i + 2],
          h: rects[i + 3],
          color: rects[i + 4] * 0x111111,
        })
      }
    },

    show(view) {
      // No view yet: keep what's on screen.
      if (!view) return
      const onTurn = view.screen === 'turn'
      // No arrow key: the arrow on the watch is still Google Maps' current one. If this page
      // never got one (a view raced ahead of the turnCard.current reply), ask for it.
      if ('arrow' in view) this.drawArrow(view.arrow)
      else if (onTurn && !this.knowsArrow) this.askForCurrent()
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
