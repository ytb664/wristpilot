// Google Maps' arrow, as rects from the side service ({ w, h, rects: [x, y, w, h, level, ...] }),
// turned into the CANVAS drawRect calls that draw it on the watch.
//
// drawRect takes two corners (x1, y1, x2, y2), not x/y/w/h: @zeppos/device-types says x/y/w/h,
// but the watch follows docs.zepp.com and draws nothing for those. The docs don't say whether the
// far corner is drawn, so x2/y2 is one past the rect: at worst a rect spills one pixel onto its
// neighbour, where x + w - 1 would make every one-pixel rect vanish.
// left/top place the arrow in the canvas; brightness dims it on the Stale Turn Card.

export function arrowDrawRects({ rects }, { left, top, brightness }) {
  const calls = []
  for (let i = 0; i < rects.length; i += 5) {
    const x1 = left + rects[i]
    const y1 = top + rects[i + 1]
    calls.push({
      x1,
      y1,
      x2: x1 + rects[i + 2],
      y2: y1 + rects[i + 3],
      color: Math.round(rects[i + 4] * brightness) * 0x111111,
    })
  }
  return calls
}
