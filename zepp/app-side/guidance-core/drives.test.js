// Replays the Drive Recordings in fixtures/ through the Guidance core's seam and checks the
// watch against what Google Maps showed. The recordings hold real streets around the user's
// home, so they stay on the developer's Mac (fixtures/*.jsonl is gitignored) and these tests
// skip where there are none. No street from a recording is written here: every check compares
// the watch with the recording itself.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { createGuidanceCore } from './index.js'

const FIXTURES = new URL('./fixtures/', import.meta.url)
const recordings = readdirSync(FIXTURES).filter((name) => name.endsWith('.jsonl'))

// What Google Maps showed: a distance in the title, the street alone in the text.
const DISTANCE = /^\d+(?:\.\d+)? (?:m|km)$/
const plain = (text) => (text || '').replace(/\s+/g, ' ').trim()
const metres = (distance) => parseFloat(distance) * (distance.endsWith('km') ? 1000 : 1)

// The side service's tick, and how long after a Navigation Session the watch must be waiting.
const TICK_MS = 1000
const SETTLE_MS = 6000

// Replays one recording as the side service would: each snapshot at the time the forwarder got
// it, ticks in between. After each snapshot, the Turn Card View as the watch holds it (a view
// without an arrow keeps the arrow shown).
function replay(snapshots) {
  const core = createGuidanceCore()
  let watch = null
  const buzzes = []
  const after = []
  const take = ({ view, buzzes: sent }, now) => {
    if (view) watch = 'arrow' in view || !watch ? view : { ...view, arrow: watch.arrow }
    for (const buzz of sent) buzzes.push({ at: now, buzz })
  }
  let last = snapshots[0].at
  for (const snapshot of snapshots) {
    for (let t = last + TICK_MS; t < snapshot.at; t += TICK_MS) take(core.tick(t), t)
    last = snapshot.at
    take(core.receive(snapshot, snapshot.at), snapshot.at)
    after.push(watch)
  }
  for (let t = last + TICK_MS; t <= last + SETTLE_MS; t += TICK_MS) take(core.tick(t), t)
  return { after, buzzes, end: watch }
}

// Google Maps' own Maneuvers: runs of distance posts with one arrow and street, split where the
// distance jumps back up from "0 m" (two turns in a row onto the same street).
function maneuversOf(snapshots) {
  const maneuvers = []
  let current = null
  for (const s of snapshots) {
    if (s.event !== 'posted') {
      current = null
      continue
    }
    const title = plain(s.title)
    if (!DISTANCE.test(title) || !plain(s.text)) continue
    const key = `${s.icon?.data}|${plain(s.text)}`
    const d = metres(title)
    if (!current || current.key !== key || (current.reachedZero && d >= 50)) {
      current = { key, from: s.at, to: s.at, distances: [] }
      maneuvers.push(current)
    }
    if (d === 0 && current.distances.some((x) => x > 0)) current.reachedZero = true
    current.distances.push(d)
    current.to = s.at
  }
  return maneuvers
}

for (const name of recordings) {
  const snapshots = readFileSync(new URL(name, FIXTURES), 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line))
  const { after, buzzes, end } = replay(snapshots)

  test(`${name}: the Turn Card shows Google Maps' distance, street and arrow`, () => {
    snapshots.forEach((s, i) => {
      const title = plain(s.title)
      if (s.event !== 'posted' || !DISTANCE.test(title) || metres(title) === 0 || !plain(s.text)) return
      const watch = after[i]
      const where = `snapshot ${i}`
      assert.equal(watch?.screen, 'turn', where)
      assert.equal(watch.distance, title, where)
      assert.equal(watch.street, plain(s.text), where)
      assert.equal(watch.arrow?.data ?? null, s.icon?.data ?? null, where)
    })
  })

  test(`${name}: the watch is back on the Waiting Screen after the Navigation Session`, () => {
    assert.equal(end?.screen, 'waiting')
  })

  test(`${name}: every Maneuver first shown beyond 100 m gets one Turn-Now Alert before it ends`, () => {
    for (const m of maneuversOf(snapshots)) {
      const firstReal = m.distances.find((d) => d > 0)
      if (!(firstReal > 100) || !m.distances.some((d) => d <= 100)) continue
      const alerts = buzzes.filter((b) => b.buzz === 'turnNow' && b.at >= m.from && b.at <= m.to)
      assert.equal(alerts.length, 1, `Maneuver at +${((m.from - snapshots[0].at) / 1000).toFixed(0)} s`)
    }
  })

  test(`${name}: no new-Maneuver buzz comes within 2 s of another buzz`, () => {
    buzzes.forEach((b, i) => {
      if (i === 0 || b.buzz !== 'newManeuver') return
      assert.ok(b.at - buzzes[i - 1].at >= 2000, `buzz at +${((b.at - snapshots[0].at) / 1000).toFixed(1)} s`)
    })
  })
}

test('Drive Recordings to replay', { skip: recordings.length ? false : 'none in fixtures/ (they stay on the Mac that recorded them)' }, () => {})
