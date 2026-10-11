import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createStaleTimer, STALE_AFTER_MS } from './stale-timer.js'

test('the Turn Card goes stale 5 s after the last message from the Navigation Phone', () => {
  const stale = createStaleTimer()
  stale.heard(10_000)

  assert.equal(STALE_AFTER_MS, 5000)
  assert.equal(stale.isStale(14_999), false)
  assert.equal(stale.isStale(15_000), true)
})

test('every message, heartbeats included, starts the wait again', () => {
  const stale = createStaleTimer()
  stale.heard(0)
  stale.heard(2000)
  stale.heard(4000)

  assert.equal(stale.isStale(8000), false)
  assert.equal(stale.isStale(9000), true)
})

test('nothing is stale before the first message: there is no Turn Card to distrust', () => {
  const stale = createStaleTimer()

  assert.equal(stale.isStale(60_000), false)
})

test('a message after a silence says contact is back, and the Turn Card is no longer stale', () => {
  const stale = createStaleTimer()
  stale.heard(0)

  assert.equal(stale.heard(7000), true)
  assert.equal(stale.isStale(7000), false)
  assert.equal(stale.heard(8000), false)
})

test('the first message is not a return from silence', () => {
  const stale = createStaleTimer()

  assert.equal(stale.heard(60_000), false)
})

test('the timeout can be tuned', () => {
  const stale = createStaleTimer({ staleAfterMs: 2000 })
  stale.heard(0)

  assert.equal(stale.isStale(1999), false)
  assert.equal(stale.isStale(2000), true)
})
