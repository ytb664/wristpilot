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
// without an arrow keeps the arrow shown), and the buzzes by the snapshot they came after.
function replay(snapshots) {
  const core = createGuidanceCore()
  let watch = null
  const buzzes = []
  const after = []
  const take = ({ view, buzzes: sent }, now, index) => {
    if (view) watch = 'arrow' in view || !watch ? view : { ...view, arrow: watch.arrow }
    for (const buzz of sent) buzzes.push({ at: now, index, buzz })
  }
  let last = snapshots[0].at
  snapshots.forEach((snapshot, i) => {
    for (let t = last + TICK_MS; t < snapshot.at; t += TICK_MS) take(core.tick(t), t, i - 1)
    last = snapshot.at
    take(core.receive(snapshot, snapshot.at), snapshot.at, i)
    after.push(watch)
  })
  for (let t = last + TICK_MS; t <= last + SETTLE_MS; t += TICK_MS) take(core.tick(t), t, snapshots.length - 1)
  return { after, buzzes, end: watch }
}

// Google Maps' distance posts (a distance in the title, a street in the text), each with the
// distance post before it in the same Navigation Session, if any.
function distancePosts(snapshots) {
  const posts = []
  let previous = null
  snapshots.forEach((s, index) => {
    if (s.event !== 'posted') {
      previous = null
      return
    }
    const title = plain(s.title)
    if (!DISTANCE.test(title) || !plain(s.text)) return
    const post = { index, metres: metres(title), arrow: s.icon?.data ?? null, street: plain(s.text), previous }
    posts.push(post)
    previous = post
  })
  return posts
}

// A backlog the forwarder delivers all at once (HyperOS froze it) can't be spaced out. Google
// Maps' post time says how late a snapshot came (format v3 on); a v2 recording only shows the
// backlog as snapshots arriving a fraction of a second apart.
function heldBack(snapshots, i) {
  const s = snapshots[i]
  if (s.postedAt) return s.at - s.postedAt > 5000
  return i > 0 && s.at - snapshots[i - 1].at < 300
}

const sameManeuverShown = (a, b) => a.arrow === b.arrow && a.street === b.street
const at = (snapshots, i) => `+${((snapshots[i].at - snapshots[0].at) / 1000).toFixed(1)} s`

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

  const posts = distancePosts(snapshots)
  const buzzedAt = (index, buzz) => buzzes.some((b) => b.index === index && b.buzz === buzz)

  test(`${name}: a new arrow or street with a real distance buzzes as a new Maneuver`, () => {
    for (const post of posts) {
      if (!post.previous || post.metres === 0 || sameManeuverShown(post, post.previous)) continue
      assert.ok(buzzedAt(post.index, 'newManeuver'), `snapshot ${post.index} at ${at(snapshots, post.index)}`)
    }
  })

  test(`${name}: the distance dropping from beyond 100 m to 100 m or less gives the Turn-Now Alert`, () => {
    for (const post of posts) {
      const { previous } = post
      if (!previous || !sameManeuverShown(post, previous) || !(previous.metres > 100 && post.metres <= 100)) continue
      assert.ok(buzzedAt(post.index, 'turnNow'), `snapshot ${post.index} at ${at(snapshots, post.index)}`)
    }
  })

  test(`${name}: no two buzzes less than 1 s apart, outside a held-back backlog`, () => {
    buzzes.forEach((b, i) => {
      if (i === 0) return
      if (!heldBack(snapshots, b.index)) assert.ok(b.at - buzzes[i - 1].at >= 1000, `buzz at ${at(snapshots, b.index)}`)
    })
  })
}

test('Drive Recordings to replay', { skip: recordings.length ? false : 'none in fixtures/ (they stay on the Mac that recorded them)' }, () => {})
