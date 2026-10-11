// Turns Google Maps' arrow image, as the forwarder sends it, into rectangles the watch draws
// on a canvas: { w, h, rects: [x, y, w, h, level, ...] }. level 1–15 is the pixel's gray as it
// looks over the black Turn Card (level × 0x111111); black and clear pixels are left out.
// A rect is a run of equal pixels in a row, grown down while the rows below repeat it, so the
// watch needs few draw calls and the Bluetooth message stays small.

export function arrowRects({ w, h, format, data }) {
  // "ga44": one byte per pixel, high nibble gray, low nibble alpha (see RawGuidanceSnapshot.kt).
  if (format !== 'ga44') return null
  const bytes = fromBase64(data)
  const rects = []
  let above = new Map() // runs that reached the row above: "x,w,level" -> index in rects
  for (let y = 0; y < h; y++) {
    const here = new Map()
    let x = 0
    while (x < w) {
      const level = drawnLevel(bytes[y * w + x])
      let end = x + 1
      while (end < w && drawnLevel(bytes[y * w + end]) === level) end++
      if (level > 0) {
        const key = `${x},${end - x},${level}`
        let i = above.get(key)
        if (i === undefined) {
          i = rects.length
          rects.push(x, y, end - x, 1, level)
        } else {
          rects[i + 3]++
        }
        here.set(key, i)
      }
      x = end
    }
    above = here
  }
  return { w, h, rects }
}

function drawnLevel(byte) {
  return Math.round(((byte >> 4) * (byte & 0x0f)) / 15)
}

// The side service has no Buffer or atob.
const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function fromBase64(text) {
  const bytes = []
  let bits = 0
  let value = 0
  for (const c of text) {
    const digit = BASE64.indexOf(c)
    if (digit < 0) continue // "=" padding
    value = ((value << 6) | digit) & 0xffff
    bits += 6
    if (bits >= 8) {
      bits -= 8
      bytes.push((value >> bits) & 0xff)
    }
  }
  return bytes
}
