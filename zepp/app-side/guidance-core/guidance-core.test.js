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

// Replays a drive: [time, snapshot] pairs, or [time, 'tick'] for time passing with no notification.
// Returns the views the watch was sent, with their times.
function drive(steps) {
  const core = createGuidanceCore()
  const views = []
  for (const [now, input] of steps) {
    const out = input === 'tick' ? core.tick(now) : core.receive(input, now)
    if (out.view) views.push([now, out.view])
  }
  return views
}

function turn(fields) {
  return { screen: 'turn', distance: '', street: '', instruction: '', tripLine: '', ...fields }
}

test('the Turn Card shows the distance, the street and the trip line', () => {
  const views = drive([
    [1_000, posted({ title: '350\u00a0m', text: 'Jl. Sudirman', subText: '13 min · 3.5 km · 14:32 ETA' })],
  ])

  assert.deepEqual(views, [
    [1_000, turn({ distance: '350 m', street: 'Jl. Sudirman', tripLine: 'ETA 14:32 · 13 min' })],
  ])
})

test('a turn in the text becomes the instruction and the road after it the street', () => {
  const views = drive([
    [1_000, posted({ title: '200 m', text: 'Turn right onto Jl. Sudirman' })],
    [2_000, posted({ title: '80 m', text: 'Slight left toward Jl. Gatot Subroto' })],
  ])

  assert.deepEqual(views, [
    [1_000, turn({ distance: '200 m', street: 'Jl. Sudirman', instruction: 'Turn right' })],
    [2_000, turn({ distance: '80 m', street: 'Jl. Gatot Subroto', instruction: 'Slight left' })],
  ])
})

test('a distance in the instruction text is shown when the title has none', () => {
  const views = drive([
    [1_000, posted({ text: 'In 200 m, turn right onto Jl. Sudirman' })],
    [2_000, posted({ text: 'Turn right onto Jl. Sudirman in 1.2\u00a0km' })],
  ])

  assert.deepEqual(views, [
    [1_000, turn({ distance: '200 m', street: 'Jl. Sudirman', instruction: 'Turn right' })],
    [2_000, turn({ distance: '1.2 km', street: 'Jl. Sudirman', instruction: 'Turn right' })],
  ])
})

test('no distance is shown when Google Maps gives none', () => {
  const views = drive([[1_000, posted({ title: 'Head north', text: 'Jl. Sudirman' })]])

  assert.deepEqual(views, [[1_000, turn({ street: 'Jl. Sudirman', instruction: 'Head north' })]])
})

test('the start of a Navigation Session does not show "0 m" before the first real distance', () => {
  const trip = '4 min · 1.4 km · 3:55 PM ETA'
  const views = drive([
    [1_000, posted({ title: 'Starting navigation…' })],
    [2_000, posted({ title: '0 m', text: 'Jl. Alpha', subText: trip })],
    [3_000, posted({ title: '110 m', text: 'Jl. Alpha', subText: trip })],
    [4_000, posted({ title: '0 m', text: 'Jl. Alpha', subText: trip })],
  ])

  assert.deepEqual(views, [
    [1_000, turn({ instruction: 'Starting navigation…' })],
    [2_000, turn({ street: 'Jl. Alpha', tripLine: 'ETA 3:55 PM · 4 min' })],
    [3_000, turn({ distance: '110 m', street: 'Jl. Alpha', tripLine: 'ETA 3:55 PM · 4 min' })],
    [4_000, turn({ distance: '0 m', street: 'Jl. Alpha', tripLine: 'ETA 3:55 PM · 4 min' })],
  ])
})

test('a re-post with an empty title keeps the distance, and an unchanged Turn Card is not resent', () => {
  const trip = '4 min · 1.4 km · 3:56 PM ETA'
  const views = drive([
    [1_000, posted({ title: '90 m', text: 'Jl. Alpha', subText: trip })],
    [2_000, posted({ title: '', text: 'Jl. Alpha', subText: trip })],
    [3_000, posted({ title: '90 m', text: 'Jl. Alpha', subText: trip })],
  ])

  assert.deepEqual(views, [[1_000, turn({ distance: '90 m', street: 'Jl. Alpha', tripLine: 'ETA 3:56 PM · 4 min' })]])
})

test('cancelling directions goes straight to the Waiting Screen', () => {
  const trip = '2 min · 300 m · 2:00 PM ETA'
  const views = drive([
    [1_000, posted({ title: '250 m', text: 'Jl. Alpha', subText: trip })],
    [2_000, removed({ title: '250 m', text: 'Jl. Alpha', subText: trip })],
  ])

  assert.deepEqual(views, [
    [1_000, turn({ distance: '250 m', street: 'Jl. Alpha', tripLine: 'ETA 2:00 PM · 2 min' })],
    [2_000, { screen: 'waiting' }],
  ])
})

test('arriving shows "Arrived" for a few seconds, then the Waiting Screen', () => {
  const trip = '0 min · 60 m · 4:03 PM ETA'
  const views = drive([
    [1_000, posted({ title: '10 m', text: 'Jl. Alpha', subText: trip })],
    [2_000, removed({ title: '10 m', text: 'Jl. Alpha', subText: trip })],
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
  const views = drive([
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
  const views = drive([
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
  const views = drive([
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
  const views = drive([
    [1_000, posted({ title: '350 m', text: 'Jl. Alpha' })],
    [2_000, posted(rating)],
    [3_000, removed(rating)],
  ])

  assert.deepEqual(views, [[1_000, turn({ distance: '350 m', street: 'Jl. Alpha' })]])
})

test('an ongoing Google Maps notification without a navigation category still counts as guidance', () => {
  const views = drive([[1_000, posted({ title: '350 m', text: 'Jl. Alpha', category: null })]])

  assert.deepEqual(views, [[1_000, turn({ distance: '350 m', street: 'Jl. Alpha' })]])
})

test('a street Google Maps only heads "toward" keeps that word', () => {
  const views = drive([[1_000, posted({ title: '230 m', text: 'toward Jl. H. Foxtrot' })]])

  assert.deepEqual(views, [[1_000, turn({ distance: '230 m', street: 'toward Jl. H. Foxtrot' })]])
})
