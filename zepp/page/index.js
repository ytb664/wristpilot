// Turn Card page. Renders whatever Turn Card View the side service sends; no parsing here.
import * as hmUI from '@zos/ui'
import { getDeviceInfo } from '@zos/device'
import { BasePage } from '@zeppos/zml/base-page'

const { width: WIDTH, height: HEIGHT } = getDeviceInfo()
const WAITING_TEXT = 'Waiting for Google Maps'
const ARRIVED_TEXT = 'Arrived'

const WHITE = 0xffffff
const GREY = 0xaaaaaa

// Turn Card layout on the round 480×480 screen, top to bottom. Each row is narrowed to stay
// inside the circle at its lowest edge.
const ARROW = { x: WIDTH / 2 - 50, y: 40, w: 100, h: 100 }
const INSTRUCTION = { x: 80, y: 145, w: WIDTH - 160, h: 40, text_size: 30, color: GREY }
const DISTANCE = { x: 40, y: 185, w: WIDTH - 80, h: 110, text_size: 96, color: WHITE }
const STREET = { x: 40, y: 295, w: WIDTH - 80, h: 56, text_size: 44, color: WHITE }
const TRIP_LINE = { x: 80, y: 365, w: WIDTH - 160, h: 40, text_size: 30, color: GREY }

Page(
  BasePage({
    build() {
      this.turnCard = [
        this.genericArrow(),
        (this.instruction = line(INSTRUCTION)),
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
        text_size: 40,
        align_h: hmUI.align.CENTER_H,
        align_v: hmUI.align.CENTER_V,
        text_style: hmUI.text_style.WRAP,
        text: WAITING_TEXT,
      })
      this.show({ screen: 'waiting' })
      // The page may open mid-Navigation Session: ask for the current view.
      this.request({ method: 'turnCard.current' })
        .then((view) => this.show(view))
        .catch(() => {})
    },

    onCall({ method, params }) {
      if (method === 'turnCard.view') this.show(params)
    },

    // Google Maps' own arrow replaces this in ticket 04.
    genericArrow() {
      const arrow = hmUI.createWidget(hmUI.widget.CANVAS, ARROW)
      const mid = ARROW.w / 2
      arrow.drawPoly({
        color: WHITE,
        data_array: [
          { x: mid, y: 0 },
          { x: ARROW.w - 5, y: 50 },
          { x: 5, y: 50 },
        ],
      })
      arrow.drawRect({ x: mid - 16, y: 50, w: 32, h: ARROW.h - 50, color: WHITE })
      return arrow
    },

    show(view) {
      // No view yet: keep what's on screen.
      if (!view) return
      const onTurn = view.screen === 'turn'
      for (const widget of this.turnCard) widget.setProperty(hmUI.prop.VISIBLE, onTurn)
      this.message.setProperty(hmUI.prop.VISIBLE, !onTurn)
      if (!onTurn) {
        this.message.setProperty(hmUI.prop.MORE, {
          text: view.screen === 'arrived' ? ARRIVED_TEXT : WAITING_TEXT,
          text_size: view.screen === 'arrived' ? 72 : 40,
        })
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
