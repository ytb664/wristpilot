import { test } from 'node:test'
import assert from 'node:assert/strict'
import { arrowRects } from './arrow-rects.js'

function icon(w, h, bytes) {
  return { w, h, format: 'ga44', data: Buffer.from(bytes).toString('base64') }
}

test('equal pixels in a row become one rect, grown down while the rows below repeat it', () => {
  const rects = arrowRects(icon(3, 3, [
    0xff, 0xff, 0x00,
    0xff, 0xff, 0x00,
    0x00, 0xff, 0xff,
  ]))

  assert.deepEqual(rects, { w: 3, h: 3, rects: [0, 0, 2, 2, 15, 1, 2, 2, 1, 15] })
})

test('each pixel is drawn as its gray over the black Turn Card, and clear pixels are skipped', () => {
  // White at half alpha and mid-gray opaque look the same; then mid-gray at half alpha,
  // black opaque, white clear.
  const rects = arrowRects(icon(5, 1, [0xf8, 0x8f, 0x88, 0x0f, 0xf0]))

  assert.deepEqual(rects, { w: 5, h: 1, rects: [0, 0, 2, 1, 8, 2, 0, 1, 1, 4] })
})

test('an image in an unknown format draws nothing', () => {
  assert.equal(arrowRects({ w: 1, h: 1, format: 'rgba8888', data: 'AAAAAA==' }), null)
})
