// Turn Card page. Renders whatever Turn Card View the side service sends; no parsing here.
import * as hmUI from '@zos/ui'
import { getDeviceInfo } from '@zos/device'
import { BasePage } from '@zeppos/zml/base-page'

const { width: WIDTH, height: HEIGHT } = getDeviceInfo()
const WAITING_TEXT = 'Waiting for Google Maps'

Page(
  BasePage({
    build() {
      this.text = hmUI.createWidget(hmUI.widget.TEXT, {
        x: 40,
        y: 0,
        w: WIDTH - 80,
        h: HEIGHT,
        color: 0xffffff,
        text_size: 40,
        align_h: hmUI.align.CENTER_H,
        align_v: hmUI.align.CENTER_V,
        text_style: hmUI.text_style.WRAP,
        text: WAITING_TEXT,
      })
      // The page may open mid-Navigation Session: ask for the current view.
      this.request({ method: 'turnCard.current' })
        .then((view) => this.show(view))
        .catch(() => {})
    },

    onCall({ method, params }) {
      if (method === 'turnCard.view') this.show(params)
    },

    show(view) {
      // No view yet: keep the Waiting Screen.
      if (!view) return
      const text = view.screen === 'turn' ? view.maneuverText : WAITING_TEXT
      this.text.setProperty(hmUI.prop.TEXT, text)
    },
  }),
)
