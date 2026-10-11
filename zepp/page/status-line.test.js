import { test } from 'node:test'
import assert from 'node:assert/strict'
import { statusLine } from './status-line.js'

test("the watch's time and battery, on the 24-hour clock", () => {
  assert.equal(statusLine({ hour: 8, minute: 5, twelveHour: false, battery: 85 }), '08:05 · 85%')
  assert.equal(statusLine({ hour: 17, minute: 42, twelveHour: false, battery: 100 }), '17:42 · 100%')
})

test('on the 12-hour clock the hour is not padded', () => {
  assert.equal(statusLine({ hour: 5, minute: 42, twelveHour: true, battery: 7 }), '5:42 · 7%')
})
