import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatTimeline } from './timeline.js'

// A 4×2 "ga44" icon: left half opaque white, right half transparent.
const ICON = {
  w: 4,
  h: 2,
  format: 'ga44',
  data: Buffer.from([0xff, 0xff, 0x00, 0x00, 0xff, 0xff, 0x00, 0x00]).toString('base64'),
}

function snapshot(fields) {
  return JSON.stringify({
    v: 2,
    event: 'posted',
    at: 1_700_000_000_000,
    key: '0|com.google.android.apps.maps|1|null|10123',
    title: '',
    text: '',
    bigText: '',
    subText: '',
    textLines: [],
    ongoing: true,
    category: 'navigation',
    icon: null,
    ...fields,
  })
}

test('each snapshot shows its time since the start, event and text fields', () => {
  const out = formatTimeline([
    snapshot({ title: '350 m', text: 'Turn right onto Jl. Sudirman', subText: '13 min · 3.5 km · 14:32 ETA' }),
    snapshot({ at: 1_700_000_083_500, title: '200 m', text: 'Turn right onto Jl. Sudirman' }),
  ])

  assert.match(out, /^\+0:00\.0 {2}posted\b.*\n {2}title: {4}350 m\n {2}text: {5}Turn right onto Jl\. Sudirman\n {2}subText: {2}13 min · 3\.5 km · 14:32 ETA$/m)
  assert.match(out, /^\+1:23\.5 {2}posted\b.*\n {2}title: {4}200 m$/m)
})

test('the arrow icon is drawn as ASCII, and only again when it changes', () => {
  const out = formatTimeline([
    snapshot({ title: '350 m', icon: ICON }),
    snapshot({ title: '300 m', icon: ICON }),
    snapshot({ title: '10 m', icon: null }),
  ])

  // 2 pixel rows squeeze into 1 text row; opaque pixels are ink, transparent are blank.
  assert.match(out, /title: {4}350 m\n {2}icon:\n {4}@@ {2}\n/)
  assert.match(out, /title: {4}300 m\n {2}icon: {5}\(same\)/)
  assert.match(out, /title: {4}10 m\n {2}icon: {5}\(none\)/)
})

test('removals, v1 snapshots and unreadable lines still show up', () => {
  const out = formatTimeline([
    snapshot({ v: 1, icon: undefined, title: 'Head north' }),
    'not json',
    snapshot({ event: 'removed', at: 1_700_000_001_000 }),
  ])

  assert.match(out, /^\+0:00\.0 {2}posted .*v1/m)
  assert.match(out, /^line 2: unreadable$/m)
  assert.match(out, /^\+0:01\.0 {2}removed/m)
})

test('v3 snapshots are timed by when Google Maps posted them, and late deliveries are flagged', () => {
  const out = formatTimeline([
    snapshot({ v: 3, postedAt: 1_700_000_000_000, title: '300 m' }),
    // Posted 10 s in, but the forwarder was frozen and only got it 12 minutes later.
    snapshot({ v: 3, postedAt: 1_700_000_010_000, at: 1_700_000_730_000, title: '200 m' }),
    snapshot({ v: 3, postedAt: 1_700_000_011_000, at: 1_700_000_011_500, title: '190 m' }),
  ])

  assert.match(out, /^\+0:10\.0 {2}posted .*v3.*delivered 720\.0 s late$/m)
  assert.match(out, /^\+0:11\.0 {2}posted .*v3[^\n]*$/m)
  assert.doesNotMatch(out, /^\+0:11\.0 .*late/m)
})

test('v3 removals have no post time, so they say they are timed by delivery', () => {
  const out = formatTimeline([
    // A removal that reached a frozen forwarder late, ahead of earlier posts.
    snapshot({ v: 3, event: 'removed', postedAt: null, at: 1_700_000_010_000 }),
    snapshot({ v: 3, postedAt: 1_700_000_000_000, at: 1_700_000_010_000, title: '50 m' }),
  ])

  assert.match(out, /^\+0:00\.0 {2}removed .*v3.* {2}timed by delivery$/m)
  assert.match(out, /^-0:10\.0 {2}posted .*delivered 10\.0 s late$/m)
})
