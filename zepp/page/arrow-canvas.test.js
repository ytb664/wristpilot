import { test } from 'node:test'
import assert from 'node:assert/strict'
import { arrowDrawRects } from './arrow-canvas.js'

// A 4×2 arrow: a 2-wide bright run, and a dim 1×1 pixel below it.
const ARROW = { w: 4, h: 2, rects: [1, 0, 2, 1, 15, 3, 1, 1, 1, 5] }

test("each rect is drawn by its corners, as the watch's CANVAS drawRect takes them", () => {
  assert.deepEqual(arrowDrawRects(ARROW, { left: 10, top: 20, brightness: 1 }), [
    { x1: 11, y1: 20, x2: 13, y2: 21, color: 0xffffff },
    { x1: 13, y1: 21, x2: 14, y2: 22, color: 0x555555 },
  ])
})

test('a one-pixel rect still has a size, whether the far corner is drawn or not', () => {
  const [{ x1, y1, x2, y2 }] = arrowDrawRects({ w: 1, h: 1, rects: [0, 0, 1, 1, 15] }, { left: 0, top: 0, brightness: 1 })
  assert.ok(x2 > x1 && y2 > y1)
})

test('the Stale Turn Card dims the arrow', () => {
  const [bright] = arrowDrawRects(ARROW, { left: 0, top: 0, brightness: 0.35 })
  assert.equal(bright.color, 5 * 0x111111)
})
