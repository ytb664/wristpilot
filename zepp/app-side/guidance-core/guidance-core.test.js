import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGuidanceCore } from './index.js'

function posted(fields) {
  return {
    v: 1,
    event: 'posted',
    at: 0,
    key: '0|com.google.android.apps.maps|1|null|10123',
    title: '',
    text: '',
    bigText: '',
    subText: '',
    textLines: [],
    ongoing: true,
    category: 'navigation',
    ...fields,
  }
}

test('a Google Maps navigation notification shows its title on the Turn Card', () => {
  const core = createGuidanceCore()

  const out = core.receive(
    posted({ title: 'Turn right onto Jl. Sudirman', text: '13 min · 3.5 km · 14:32 ETA' }),
    1_000,
  )

  assert.deepEqual(out, {
    view: { screen: 'turn', maneuverText: 'Turn right onto Jl. Sudirman' },
    buzzes: [],
  })
})

test('removing the navigation notification returns the watch to the Waiting Screen', () => {
  const core = createGuidanceCore()
  core.receive(posted({ title: 'Head north' }), 1_000)

  const out = core.receive(posted({ event: 'removed', title: 'Head north' }), 2_000)

  assert.deepEqual(out, { view: { screen: 'waiting' }, buzzes: [] })
})

test('a Google Maps notification that is not navigation guidance leaves the watch unchanged', () => {
  const core = createGuidanceCore()

  const out = core.receive(
    posted({ title: 'Rate your visit to Plaza Senayan', ongoing: false, category: null }),
    1_000,
  )

  assert.deepEqual(out, { view: null, buzzes: [] })
})

test('an ongoing Google Maps notification without a navigation category still counts as guidance', () => {
  const core = createGuidanceCore()

  const out = core.receive(posted({ title: '350 m', category: null, ongoing: true }), 1_000)

  assert.deepEqual(out, { view: { screen: 'turn', maneuverText: '350 m' }, buzzes: [] })
})
