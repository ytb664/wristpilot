import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGuidanceCore } from './index.js'

// Shaped like Google Maps' navigation notification on the Navigation Phone:
// distance in the title, street (sometimes with the turn) in the text, trip line in the sub text.
function posted(fields) {
  return {
    v: 3,
    event: 'posted',
    at: 0,
    postedAt: 0,
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
  }
}

function removed(fields) {
  return posted({ event: 'removed', postedAt: null, ...fields })
}

// Replays Google Maps' notifications: [time, snapshot] pairs, or [time, 'tick'] for time passing
// with no notification. Returns what the watch was sent, with its times: views and Buzz commands.
function drive(inputs) {
  const core = createGuidanceCore()
  const views = []
  const buzzes = []
  for (const [now, input] of inputs) {
    const out = input === 'tick' ? core.tick(now) : core.receive(input, now)
    if (out.view) views.push([now, out.view])
    for (const buzz of out.buzzes) buzzes.push([now, buzz])
  }
  return { views, buzzes }
}

function replay(inputs) {
  return drive(inputs).views
}

function buzzes(inputs) {
  return drive(inputs).buzzes
}

function turn(fields) {
  return { screen: 'turn', arrow: null, distance: '', street: '', instruction: '', tripLine: '', ...fields }
}

// A Turn Card View for a re-post whose arrow is already on the watch: the image isn't resent.
function turnSameArrow(fields) {
  const { arrow, ...view } = turn(fields)
  return view
}

// Google Maps' arrow as the forwarder sends it ("ga44": gray and alpha nibbles per pixel).
function arrowIcon(bytes, size = 120) {
  return { w: size, h: size, format: 'ga44', data: Buffer.alloc(size * size, bytes).toString('base64') }
}

const STRAIGHT = arrowIcon(0xff)
const RIGHT = arrowIcon(0xf8)

test('the Turn Card shows the distance, the street and the trip line', () => {
  const views = replay([
    [1_000, posted({ title: '350\u00a0m', text: 'Jl. Sudirman', subText: '13 min · 3.5 km · 14:32 ETA' })],
  ])

  assert.deepEqual(views, [
    [1_000, turn({ distance: '350 m', street: 'Jl. Sudirman', tripLine: 'ETA 14:32 · 13 min' })],
  ])
})

test('a turn in the text becomes the instruction and the road after it the street', () => {
  const views = replay([
    [1_000, posted({ title: '200 m', text: 'Turn right onto Jl. Sudirman' })],
    [2_000, posted({ title: '80 m', text: 'Slight left toward Jl. Gatot Subroto' })],
  ])

  assert.deepEqual(views, [
    [1_000, turn({ distance: '200 m', street: 'Jl. Sudirman', instruction: 'Turn right' })],
    [2_000, turn({ distance: '80 m', street: 'Jl. Gatot Subroto', instruction: 'Slight left' })],
  ])
})

test('a distance in the instruction text is shown when the title has none', () => {
  const views = replay([
    [1_000, posted({ text: 'In 200 m, turn right onto Jl. Sudirman' })],
    [2_000, posted({ text: 'Turn right onto Jl. Sudirman in 1.2\u00a0km' })],
  ])

  assert.deepEqual(views, [
    [1_000, turn({ distance: '200 m', street: 'Jl. Sudirman', instruction: 'Turn right' })],
    [2_000, turn({ distance: '1.2 km', street: 'Jl. Sudirman', instruction: 'Turn right' })],
  ])
})

test('no distance is shown when Google Maps gives none', () => {
  const views = replay([[1_000, posted({ title: 'Head north', text: 'Jl. Sudirman' })]])

  assert.deepEqual(views, [[1_000, turn({ street: 'Jl. Sudirman', instruction: 'Head north' })]])
})

test('the start of a Navigation Session does not show "0 m" before the first real distance', () => {
  const tripLine = '4 min · 1.4 km · 3:55 PM ETA'
  const views = replay([
    [1_000, posted({ title: 'Starting navigation…' })],
    [2_000, posted({ title: '0 m', text: 'Jl. Alpha', subText: tripLine })],
    [3_000, posted({ title: '110 m', text: 'Jl. Alpha', subText: tripLine })],
    [4_000, posted({ title: '0 m', text: 'Jl. Alpha', subText: tripLine })],
  ])

  assert.deepEqual(views, [
    [1_000, turn({ instruction: 'Starting navigation…' })],
    [2_000, turn({ street: 'Jl. Alpha', tripLine: 'ETA 3:55 PM · 4 min' })],
    [3_000, turn({ distance: '110 m', street: 'Jl. Alpha', tripLine: 'ETA 3:55 PM · 4 min' })],
    [4_000, turn({ distance: '0 m', street: 'Jl. Alpha', tripLine: 'ETA 3:55 PM · 4 min' })],
  ])
})

test('a re-post with an empty title keeps the distance, and an unchanged Turn Card is not resent', () => {
  const tripLine = '4 min · 1.4 km · 3:56 PM ETA'
  const views = replay([
    [1_000, posted({ title: '90 m', text: 'Jl. Alpha', subText: tripLine })],
    [2_000, posted({ title: '', text: 'Jl. Alpha', subText: tripLine })],
    [3_000, posted({ title: '90 m', text: 'Jl. Alpha', subText: tripLine })],
  ])

  assert.deepEqual(views, [[1_000, turn({ distance: '90 m', street: 'Jl. Alpha', tripLine: 'ETA 3:56 PM · 4 min' })]])
})

test('cancelling the Navigation Session goes straight to the Waiting Screen', () => {
  const tripLine = '2 min · 300 m · 2:00 PM ETA'
  const views = replay([
    [1_000, posted({ title: '250 m', text: 'Jl. Alpha', subText: tripLine })],
    [2_000, removed({ title: '250 m', text: 'Jl. Alpha', subText: tripLine })],
  ])

  assert.deepEqual(views, [
    [1_000, turn({ distance: '250 m', street: 'Jl. Alpha', tripLine: 'ETA 2:00 PM · 2 min' })],
    [2_000, { screen: 'waiting' }],
  ])
})

test('arriving shows "Arrived" for a few seconds, then the Waiting Screen', () => {
  const tripLine = '0 min · 60 m · 4:03 PM ETA'
  const views = replay([
    [1_000, posted({ title: '10 m', text: 'Jl. Alpha', subText: tripLine })],
    [2_000, removed({ title: '10 m', text: 'Jl. Alpha', subText: tripLine })],
    [3_000, 'tick'],
    [6_000, 'tick'],
    [7_000, 'tick'],
    [8_000, 'tick'],
  ])

  assert.deepEqual(views, [
    [1_000, turn({ distance: '10 m', street: 'Jl. Alpha', tripLine: 'ETA 4:03 PM · 0 min' })],
    [2_000, { screen: 'arrived' }],
    [7_000, { screen: 'waiting' }],
  ])
})

test('arriving at a waypoint keeps the Navigation Session going to the next stop', () => {
  const views = replay([
    [1_000, posted({ title: '20 m', text: 'Jl. Bravo Raya', subText: '0 min · 100 m · 3:58 PM ETA' })],
    [2_000, removed({ title: '20 m', text: 'Jl. Bravo Raya', subText: '0 min · 100 m · 3:58 PM ETA' })],
    [4_000, posted({ title: '230 m', text: 'Jl. Bravo I', subText: '6 min · 1.4 km · 4:04 PM ETA' })],
    [8_000, 'tick'],
    [30_000, 'tick'],
  ])

  assert.deepEqual(views, [
    [1_000, turn({ distance: '20 m', street: 'Jl. Bravo Raya', tripLine: 'ETA 3:58 PM · 0 min' })],
    [2_000, { screen: 'arrived' }],
    [4_000, turn({ distance: '230 m', street: 'Jl. Bravo I', tripLine: 'ETA 4:04 PM · 6 min' })],
  ])
})

test('the trip line leaves out whatever Google Maps does not give', () => {
  const views = replay([
    [1_000, posted({ title: '300 m', text: 'Jl. Alpha', subText: '1 hr 5 min · 52 km · 15:40 ETA' })],
    [2_000, posted({ title: '300 m', text: 'Jl. Alpha', subText: '1 hr 5 min · 52 km' })],
    [3_000, posted({ title: '300 m', text: 'Jl. Alpha', subText: '15:40 ETA' })],
    [4_000, posted({ title: '300 m', text: 'Jl. Alpha', subText: '' })],
  ])

  assert.deepEqual(views, [
    [1_000, turn({ distance: '300 m', street: 'Jl. Alpha', tripLine: 'ETA 15:40 · 1 hr 5 min' })],
    [2_000, turn({ distance: '300 m', street: 'Jl. Alpha', tripLine: '1 hr 5 min' })],
    [3_000, turn({ distance: '300 m', street: 'Jl. Alpha', tripLine: 'ETA 15:40' })],
    [4_000, turn({ distance: '300 m', street: 'Jl. Alpha' })],
  ])
})

test('a reroute puts the new Maneuver on the Turn Card', () => {
  const views = replay([
    [1_000, posted({ title: '300 m', text: 'Turn left onto Jl. Alpha', subText: '5 min · 2 km · 14:30 ETA' })],
    [2_000, posted({ title: '600 m', text: 'Turn right onto Jl. Salemba', subText: '7 min · 2.6 km · 14:32 ETA' })],
  ])

  assert.deepEqual(views, [
    [1_000, turn({ distance: '300 m', street: 'Jl. Alpha', instruction: 'Turn left', tripLine: 'ETA 14:30 · 5 min' })],
    [2_000, turn({ distance: '600 m', street: 'Jl. Salemba', instruction: 'Turn right', tripLine: 'ETA 14:32 · 7 min' })],
  ])
})

test('Google Maps notifications that are not navigation guidance leave the watch unchanged', () => {
  const rating = { title: 'Rate your visit to Plaza Senayan', ongoing: false, category: null, key: 'other' }
  const views = replay([
    [1_000, posted({ title: '350 m', text: 'Jl. Alpha' })],
    [2_000, posted(rating)],
    [3_000, removed(rating)],
  ])

  assert.deepEqual(views, [[1_000, turn({ distance: '350 m', street: 'Jl. Alpha' })]])
})

test('an ongoing Google Maps notification that is not navigation leaves the Turn Card alone', () => {
  const sharing = { title: 'Sharing location', text: 'with Budi', category: 'service', key: 'sharing' }
  const views = replay([
    [1_000, posted({ title: '350 m', text: 'Jl. Alpha' })],
    [2_000, posted(sharing)],
    [3_000, removed(sharing)],
  ])

  assert.deepEqual(views, [[1_000, turn({ distance: '350 m', street: 'Jl. Alpha' })]])
})

test('removing a navigation notification other than the Navigation Session\'s leaves the Turn Card alone', () => {
  const views = replay([
    [1_000, posted({ title: '350 m', text: 'Jl. Alpha' })],
    [2_000, removed({ title: 'Starting navigation…', key: 'an older one' })],
  ])

  assert.deepEqual(views, [[1_000, turn({ distance: '350 m', street: 'Jl. Alpha' })]])
})

test('"on" or "toward" without a turn before it is part of the street', () => {
  const views = replay([[1_000, posted({ title: '1.2 km', text: 'Rest area on the left' })]])

  assert.deepEqual(views, [[1_000, turn({ distance: '1.2 km', street: 'Rest area on the left' })]])
})

test('a new turn in the title on the same street is a new Maneuver, not the old distance', () => {
  const views = replay([
    [1_000, posted({ title: 'Head north in 300 m', text: 'Jl. Alpha' })],
    [2_000, posted({ title: 'Turn left', text: 'Jl. Alpha' })],
  ])

  assert.deepEqual(views, [
    [1_000, turn({ distance: '300 m', street: 'Jl. Alpha', instruction: 'Head north' })],
    [2_000, turn({ street: 'Jl. Alpha', instruction: 'Turn left' })],
  ])
})

test('a cancel right after an arrival keeps the Waiting Screen', () => {
  const views = replay([
    [1_000, posted({ title: '10 m', text: 'Jl. Alpha', subText: '0 min · 60 m · 4:03 PM ETA' })],
    [2_000, removed({ title: '10 m', text: 'Jl. Alpha', subText: '0 min · 60 m · 4:03 PM ETA' })],
    [3_000, posted({ title: 'Starting navigation…' })],
    [4_000, removed({ title: 'Starting navigation…' })],
    [10_000, 'tick'],
  ])

  assert.deepEqual(views, [
    [1_000, turn({ distance: '10 m', street: 'Jl. Alpha', tripLine: 'ETA 4:03 PM · 0 min' })],
    [2_000, { screen: 'arrived' }],
    [3_000, turn({ instruction: 'Starting navigation…' })],
    [4_000, { screen: 'waiting' }],
  ])
})

test('a street Google Maps only heads "toward" keeps that word', () => {
  const views = replay([[1_000, posted({ title: '230 m', text: 'toward Jl. H. Foxtrot' })]])

  assert.deepEqual(views, [[1_000, turn({ distance: '230 m', street: 'toward Jl. H. Foxtrot' })]])
})

test('Google Maps\' arrow goes on the Turn Card in place of the instruction', () => {
  const views = replay([[1_000, posted({ title: '200 m', text: 'Turn right onto Jl. Sudirman', icon: RIGHT })]])

  assert.deepEqual(views, [[1_000, turn({ arrow: RIGHT, distance: '200 m', street: 'Jl. Sudirman' })]])
})

test('re-posts with the same arrow do not resend the image', () => {
  const views = replay([
    [1_000, posted({ title: '350 m', text: 'Jl. Sudirman', icon: RIGHT })],
    [2_000, posted({ title: '200 m', text: 'Jl. Sudirman', icon: RIGHT })],
    [3_000, posted({ title: '90 m', text: 'Jl. Sudirman', icon: RIGHT })],
  ])

  assert.deepEqual(views, [
    [1_000, turn({ arrow: RIGHT, distance: '350 m', street: 'Jl. Sudirman' })],
    [2_000, turnSameArrow({ distance: '200 m', street: 'Jl. Sudirman' })],
    [3_000, turnSameArrow({ distance: '90 m', street: 'Jl. Sudirman' })],
  ])
})

test('the next Maneuver\'s arrow is sent when it differs, and not when it is the same', () => {
  const views = replay([
    [1_000, posted({ title: '50 m', text: 'Jl. Sudirman', icon: RIGHT })],
    [2_000, posted({ title: '800 m', text: 'Jl. Thamrin', icon: STRAIGHT })],
    [3_000, posted({ title: '400 m', text: 'Jl. Medan Merdeka', icon: STRAIGHT })],
  ])

  assert.deepEqual(views, [
    [1_000, turn({ arrow: RIGHT, distance: '50 m', street: 'Jl. Sudirman' })],
    [2_000, turn({ arrow: STRAIGHT, distance: '800 m', street: 'Jl. Thamrin' })],
    [3_000, turnSameArrow({ distance: '400 m', street: 'Jl. Medan Merdeka' })],
  ])
})

test('when Google Maps sends no arrow image, the instruction text shows instead', () => {
  const views = replay([
    [1_000, posted({ title: '200 m', text: 'Turn right onto Jl. Sudirman', icon: RIGHT })],
    [2_000, posted({ title: '600 m', text: 'Keep left toward Jl. Tol Dalam Kota', icon: null })],
  ])

  assert.deepEqual(views, [
    [1_000, turn({ arrow: RIGHT, distance: '200 m', street: 'Jl. Sudirman' })],
    [2_000, turn({ distance: '600 m', street: 'Jl. Tol Dalam Kota', instruction: 'Keep left' })],
  ])
})

test('a new arrow on the same street is a new Maneuver and does not keep the old distance', () => {
  const views = replay([
    [1_000, posted({ title: '90 m', text: 'Jl. Alpha', icon: STRAIGHT })],
    [2_000, posted({ title: 'Turn right', text: 'Jl. Alpha', icon: RIGHT })],
  ])

  assert.deepEqual(views, [
    [1_000, turn({ arrow: STRAIGHT, distance: '90 m', street: 'Jl. Alpha' })],
    [2_000, turn({ arrow: RIGHT, street: 'Jl. Alpha' })],
  ])
})

test('an empty-title re-post with an older arrow does not flip the arrow, but updates the trip line', () => {
  // Recorded: between "100 m" and "90 m", Google Maps re-posted with an empty title and the
  // previous Maneuver's arrow.
  const views = replay([
    [1_000, posted({ title: '100 m', text: 'Jl. Alpha', subText: '4 min · 1.4 km · 3:55 PM ETA', icon: RIGHT })],
    [2_000, posted({ title: '', text: 'Jl. Alpha', subText: '4 min · 1.4 km · 3:56 PM ETA', icon: STRAIGHT })],
    [3_000, posted({ title: '90 m', text: 'Jl. Alpha', subText: '4 min · 1.4 km · 3:56 PM ETA', icon: RIGHT })],
  ])

  assert.deepEqual(views, [
    [1_000, turn({ arrow: RIGHT, distance: '100 m', street: 'Jl. Alpha', tripLine: 'ETA 3:55 PM · 4 min' })],
    [2_000, turnSameArrow({ distance: '100 m', street: 'Jl. Alpha', tripLine: 'ETA 3:56 PM · 4 min' })],
    [3_000, turnSameArrow({ distance: '90 m', street: 'Jl. Alpha', tripLine: 'ETA 3:56 PM · 4 min' })],
  ])
})

test('a watch that opens mid-Navigation Session gets the current Turn Card with its arrow', () => {
  const core = createGuidanceCore()
  assert.equal(core.current(), null)
  core.receive(posted({ title: '350 m', text: 'Jl. Sudirman', icon: RIGHT }), 1_000)
  core.receive(posted({ title: '200 m', text: 'Jl. Sudirman', icon: RIGHT }), 2_000)

  assert.deepEqual(core.current(), turn({ arrow: RIGHT, distance: '200 m', street: 'Jl. Sudirman' }))
})

test('after the Waiting Screen, the next Navigation Session sends its arrow again', () => {
  const views = replay([
    [1_000, posted({ title: '250 m', text: 'Jl. Alpha', icon: RIGHT })],
    [2_000, removed({ title: '250 m', text: 'Jl. Alpha', icon: RIGHT })],
    [3_000, posted({ title: '250 m', text: 'Jl. Alpha', icon: RIGHT })],
  ])

  assert.deepEqual(views, [
    [1_000, turn({ arrow: RIGHT, distance: '250 m', street: 'Jl. Alpha' })],
    [2_000, { screen: 'waiting' }],
    [3_000, turn({ arrow: RIGHT, distance: '250 m', street: 'Jl. Alpha' })],
  ])
})

test('a recording made before the bigger arrow (v2, 48×48) still shows its arrow', () => {
  const small = arrowIcon(0xff, 48)
  const { postedAt, ...v2 } = posted({ v: 2, title: '110 m', text: 'Jl. Alpha', icon: small })
  const views = replay([[1_000, v2]])

  assert.deepEqual(views, [[1_000, turn({ arrow: small, distance: '110 m', street: 'Jl. Alpha' })]])
})


test('a new Maneuver buzzes once, and Google Maps re-posting its distance does not buzz again', () => {
  const sent = buzzes([
    [1_000, posted({ title: '450 m', text: 'Jl. Delta Raya', icon: RIGHT })],
    [2_000, posted({ title: '400 m', text: 'Jl. Delta Raya', icon: RIGHT })],
    [3_000, posted({ title: '400 m', text: 'Jl. Delta Raya', subText: '3 min · 1.1 km · 3:58 PM ETA', icon: RIGHT })],
    [4_000, posted({ title: '350 m', text: 'Jl. Delta Raya', icon: RIGHT })],
  ])

  assert.deepEqual(sent, [[1_000, 'newManeuver']])
})

test('the Turn-Now Alert fires once, when the distance first drops to 100 m or below', () => {
  const sent = buzzes([
    [1_000, posted({ title: '130 m', text: 'Jl. Echo Raya', icon: RIGHT })],
    [2_000, posted({ title: '110 m', text: 'Jl. Echo Raya', icon: RIGHT })],
    [3_000, posted({ title: '100 m', text: 'Jl. Echo Raya', icon: RIGHT })],
    [4_000, posted({ title: '90 m', text: 'Jl. Echo Raya', icon: RIGHT })],
    [5_000, posted({ title: '90 m', text: 'Jl. Echo Raya', subText: '1 min · 450 m · 3:58 PM ETA', icon: RIGHT })],
    [6_000, posted({ title: '40 m', text: 'Jl. Echo Raya', icon: RIGHT })],
    [7_000, posted({ title: '0 m', text: 'Jl. Echo Raya', icon: RIGHT })],
  ])

  assert.deepEqual(sent, [
    [1_000, 'newManeuver'],
    [3_000, 'turnNow'],
  ])
})

test('a Maneuver that appears at 100 m or closer only gets the new-Maneuver buzz', () => {
  const sent = buzzes([
    [1_000, posted({ title: '0 m', text: 'Jl. Alpha', icon: STRAIGHT })],
    [2_000, posted({ title: '100 m', text: 'Jl. Charlie', icon: RIGHT })],
    [3_000, posted({ title: '90 m', text: 'Jl. Charlie', icon: RIGHT })],
    [4_000, posted({ title: '10 m', text: 'Jl. Charlie', icon: RIGHT })],
  ])

  assert.deepEqual(sent, [
    [1_000, 'newManeuver'],
    [2_000, 'newManeuver'],
  ])
})

test('a reroute to a different Maneuver buzzes as new and gets its own Turn-Now Alert', () => {
  const sent = buzzes([
    [1_000, posted({ title: '120 m', text: 'Turn left onto Jl. Alpha', icon: RIGHT })],
    [2_000, posted({ title: '90 m', text: 'Turn left onto Jl. Alpha', icon: RIGHT })],
    [3_000, posted({ title: '600 m', text: 'Turn right onto Jl. Salemba', icon: STRAIGHT })],
    [4_000, posted({ title: '100 m', text: 'Turn right onto Jl. Salemba', icon: STRAIGHT })],
  ])

  assert.deepEqual(sent, [
    [1_000, 'newManeuver'],
    [2_000, 'turnNow'],
    [3_000, 'newManeuver'],
    [4_000, 'turnNow'],
  ])
})

test('the same Maneuver in the next Navigation Session buzzes again', () => {
  const sent = buzzes([
    [1_000, posted({ title: '250 m', text: 'Jl. Alpha', icon: RIGHT })],
    [2_000, removed({ title: '250 m', text: 'Jl. Alpha', icon: RIGHT })],
    [3_000, posted({ title: '250 m', text: 'Jl. Alpha', icon: RIGHT })],
  ])

  assert.deepEqual(sent, [
    [1_000, 'newManeuver'],
    [3_000, 'newManeuver'],
  ])
})

test('a Navigation Session\'s start buzzes for its first Maneuver, not for "Starting navigation…" or re-posts', () => {
  // As recorded: "Starting navigation…", the first street at "0 m" while parked, then the
  // first turn, with an empty-title re-post carrying the previous Maneuver's arrow in between.
  const tripLine = '4 min · 1.4 km · 3:56 PM ETA'
  const sent = buzzes([
    [1_000, posted({ title: 'Starting navigation…' })],
    [2_000, posted({ title: '0 m', text: 'Jl. Alpha', subText: tripLine, icon: STRAIGHT })],
    [3_000, posted({ title: '', text: 'Jl. Alpha', subText: tripLine, icon: STRAIGHT })],
    [4_000, posted({ title: '0 m', text: 'Jl. Alpha', subText: tripLine, icon: STRAIGHT })],
    [5_000, posted({ title: '110 m', text: 'Jl. Alpha', subText: tripLine, icon: RIGHT })],
    [6_000, posted({ title: '', text: 'Jl. Alpha', subText: tripLine, icon: STRAIGHT })],
    [7_000, posted({ title: '100 m', text: 'Jl. Alpha', subText: tripLine, icon: RIGHT })],
    [8_000, posted({ title: '90 m', text: 'Jl. Alpha', subText: tripLine, icon: RIGHT })],
  ])

  assert.deepEqual(sent, [
    [2_000, 'newManeuver'],
    [5_000, 'newManeuver'],
    [7_000, 'turnNow'],
  ])
})

test('a Maneuver with only a turn, no arrow and no street, still buzzes', () => {
  const sent = buzzes([
    [1_000, posted({ title: 'Starting navigation…' })],
    [2_000, posted({ title: 'Head north' })],
  ])

  assert.deepEqual(sent, [[2_000, 'newManeuver']])
})

test('a Maneuver that opened at "0 m" gets its Turn-Now Alert when its first real distance is 100 m or less', () => {
  // The opening "0 m" isn't shown, so the new-Maneuver buzz came alone, maybe long before.
  const sent = buzzes([
    [1_000, posted({ title: '0 m', text: 'Jl. Alpha', icon: STRAIGHT })],
    [60_000, posted({ title: '90 m', text: 'Jl. Alpha', icon: STRAIGHT })],
    [61_000, posted({ title: '80 m', text: 'Jl. Alpha', icon: STRAIGHT })],
  ])

  assert.deepEqual(sent, [
    [1_000, 'newManeuver'],
    [60_000, 'turnNow'],
  ])
})
