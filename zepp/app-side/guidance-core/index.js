// Guidance core: all navigation logic lives here.
// Seam: Raw Guidance Snapshots + time in -> Turn Card View + Buzz commands out.
// Pure and deterministic: no I/O, time is passed in.
//
// receive(snapshot, now) for each Raw Guidance Snapshot; tick(now) when time passes without one.
// Both return { view, buzzes }. view is null when the watch should stay as it is.
// current() is the Turn Card View on the watch in full, for a watch that has just opened.
//
// A Turn Card View's arrow is Google Maps' arrow image as the forwarder sent it, or null when
// there is none (the instruction shows instead). To keep Bluetooth traffic small, a view leaves
// the arrow out when the watch already shows that same image: no arrow key means "keep it".
//
// Buzz commands: 'newManeuver' (one short buzz) when a Maneuver appears, 'turnNow' (the
// Turn-Now Alert) once per Maneuver when its distance first drops to 100 m or below. A Maneuver
// is its arrow, turn and street within a Navigation Session; distance-only re-posts never buzz.

// How long "Arrived" stays up before the Waiting Screen.
const ARRIVED_MS = 5_000

// The Turn-Now Alert fires when the distance to the Maneuver first drops to this or below.
const TURN_NOW_M = 100

// After a Maneuver reached "0 m", a jump back up to this or more is the next turn, not the car
// creeping on past the turn ("0 m", "10 m", "20 m" was recorded before the next Maneuver).
const NEXT_TURN_M = 50

// A new-Maneuver buzz this soon after the last buzz is dropped.
const BUZZ_GAP_MS = 2_000

const NOTHING = { view: null, buzzes: [] }

export function createGuidanceCore() {
  let shown = null // the last Turn Card View sent to the watch
  let sessionKey = null // the notification key of the running Navigation Session
  let onCard = null // the Maneuver on the Turn Card: { arrow, turn, street, distance, sawRealDistance, reachedTurn, turnNowDone }
  let arrivedAt = null // when "Arrived" went up, while it is up
  let lastBuzzAt = null // when the watch last buzzed

  // The view goes out only if it changed; buzzes always do.
  function show(view, buzzes = []) {
    if (sameJson(view, shown)) return { view: null, buzzes }
    const sent = { ...view }
    if (view.arrow && shown?.screen === 'turn' && sameArrow(view.arrow, shown.arrow)) delete sent.arrow
    shown = view
    return { view: sent, buzzes }
  }

  function showManeuver(tripLineText, buzzes) {
    return show(
      {
        screen: 'turn',
        arrow: onCard.arrow,
        distance: onCard.distance,
        street: onCard.street,
        instruction: onCard.arrow ? '' : onCard.turn,
        tripLine: tripLineText,
      },
      buzzes,
    )
  }

  return {
    receive(snapshot, now) {
      if (!isGuidance(snapshot)) return NOTHING
      if (snapshot.event === 'removed') {
        if (snapshot.key !== sessionKey) return NOTHING
        sessionKey = null
        onCard = null
        arrivedAt = null
        // Google Maps removes its notification both on arrival and on cancel. Only the
        // trip line tells them apart: nothing left to drive means we arrived. Arriving at a
        // waypoint looks the same, so a new Maneuver during "Arrived" carries the session on.
        if (!isArrival(snapshot)) return show({ screen: 'waiting' })
        arrivedAt = now
        return show({ screen: 'arrived' })
      }
      sessionKey = snapshot.key
      arrivedAt = null
      const title = withoutDistance(normalise(snapshot.title))
      const text = withoutDistance(normalise(snapshot.text))
      const { instruction, street } = maneuver(text.rest)
      // Recorded: an empty title re-posts the Maneuver on the Turn Card, sometimes with the
      // previous Maneuver's arrow. Keep the Maneuver (arrow, distance) and take only the trip line.
      const rePost = !normalise(snapshot.title) && !text.distance && street === onCard?.street
      if (rePost) return showManeuver(tripLine(snapshot.subText))
      // Recorded: "Rerouting..." in the text, nothing else, between two Maneuvers. It shows, but
      // it isn't a Maneuver: no buzz, and the Maneuver after it is compared with the one before.
      if (isRerouting(street)) {
        return show({ screen: 'turn', arrow: null, distance: '', street, instruction: '', tripLine: tripLine(snapshot.subText) })
      }
      const turn = instruction || title.rest
      const arrow = snapshot.icon || null
      const distance = title.distance || text.distance
      // A Maneuver is its arrow, turn and street; a new one starts without a distance.
      // Recorded: two turns in a row with the same arrow onto the same street. The first counts
      // down to "0 m", then the distance jumps back up for the second.
      const nextTurn = onCard?.reachedTurn && distance && metres(distance) >= NEXT_TURN_M
      const buzzes = []
      if (!onCard || !sameArrow(onCard.arrow, arrow) || onCard.turn !== turn || onCard.street !== street || nextTurn) {
        onCard = { arrow, turn, street, distance: '', sawRealDistance: false, reachedTurn: false, turnNowDone: false }
        if (!isStarting(turn)) buzzes.push('newManeuver')
      }
      if (distance && !isZero(distance)) onCard.sawRealDistance = true
      if (distance && isZero(distance) && onCard.sawRealDistance) onCard.reachedTurn = true
      // Google Maps opens a Maneuver at "0 m" before its first real distance: that is not
      // "the turn is here".
      if (distance && onCard.sawRealDistance) {
        onCard.distance = distance
        if (!onCard.turnNowDone && metres(distance) <= TURN_NOW_M) {
          onCard.turnNowDone = true
          // A Maneuver that appears already within reach gets only its new-Maneuver buzz:
          // two alerts at once would say nothing more.
          if (!buzzes.length) buzzes.push('turnNow')
        }
      }
      // Two short buzzes this close feel like the Turn-Now Alert. Recorded after reroutes: the
      // "0 m" placeholder, then the real Maneuver under a second later. Only the first buzzes.
      if (buzzes[0] === 'newManeuver' && lastBuzzAt !== null && now - lastBuzzAt < BUZZ_GAP_MS) buzzes.shift()
      if (buzzes.length) lastBuzzAt = now
      return showManeuver(tripLine(snapshot.subText), buzzes)
    },

    current() {
      return shown
    },

    tick(now) {
      if (arrivedAt === null || now - arrivedAt < ARRIVED_MS) return NOTHING
      arrivedAt = null
      return show({ screen: 'waiting' })
    },
  }
}

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}

function sameArrow(a, b) {
  return a?.data === b?.data && a?.w === b?.w
}

// Recorded on the Navigation Phone: Google Maps' guidance notification has the navigation
// category. Its other ongoing notifications (e.g. location sharing) are not guidance.
function isGuidance(snapshot) {
  return snapshot.category === 'navigation'
}

// Google Maps separates numbers and units with a no-break space ("110\u00a0m").
function normalise(text) {
  return (text || '').replace(/\s+/g, ' ').trim()
}

const DISTANCE = String.raw`(\d+(?:\.\d+)?) ?(km|m)\b`

// Splits a distance off a line: "350 m", "In 200 m, turn right…", "Turn right… in 1.2 km".
// The rest is what's left of the line, capitalised.
function withoutDistance(line) {
  const bare = line.match(new RegExp(`^${DISTANCE}$`, 'i'))
  if (bare) return { distance: distanceText(bare), rest: '' }
  const phrase = line.match(new RegExp(String.raw`\s*\bin ${DISTANCE},?\s*`, 'i'))
  if (!phrase) return { distance: '', rest: line }
  const rest = (line.slice(0, phrase.index) + ' ' + line.slice(phrase.index + phrase[0].length)).trim()
  return { distance: distanceText(phrase), rest: capitalise(rest) }
}

function distanceText([, value, unit]) {
  return `${value} ${unit.toLowerCase()}`
}

// Google Maps' placeholder while it works out the first Maneuver: nothing to turn onto yet.
function isStarting(turn) {
  return /^starting navigation/i.test(turn)
}

function isRerouting(street) {
  return /^rerouting\b/i.test(street)
}

function isZero(distance) {
  return parseFloat(distance) === 0
}

// "350 m" -> 350, "1.2 km" -> 1200.
function metres(distance) {
  const [value, unit] = distance.split(' ')
  return parseFloat(value) * (unit === 'km' ? 1000 : 1)
}

function capitalise(text) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

// "Turn right onto Jl. Sudirman" -> instruction "Turn right", street "Jl. Sudirman".
// Google Maps often sends the street alone (the arrow shows the turn): no instruction then.
// Without a turn word first, "toward Jl. H. Foxtrot" or "Rest area on the left" is the street line.
const TURN_WORDS = 'turn|slight|sharp|keep|bear|head|continue|merge|take|make|exit|stay|go'

function maneuver(text) {
  const match = text.match(new RegExp(String.raw`^((?:${TURN_WORDS})\b.*?)\s+(?:onto|on|toward|towards)\s+(.+)$`, 'i'))
  if (!match) return { instruction: '', street: text }
  return { instruction: match[1], street: match[2] }
}

// Recorded: arrival removed the notification at "0 min · 60 m", a cancel at "2 min · 300 m".
// So a cancel within the last minute also shows "Arrived"; ticket 09's recordings may refine this.
function isArrival(snapshot) {
  return /^0 min$/i.test(tripParts(snapshot.subText).remaining)
}

// "13 min · 3.5 km · 14:32 ETA" -> "ETA 14:32 · 13 min".
function tripLine(subText) {
  const { eta, remaining } = tripParts(subText)
  return [eta && `ETA ${eta}`, remaining].filter(Boolean).join(' · ')
}

// Google Maps' trip line: time remaining, distance remaining and arrival time, any of them missing.
function tripParts(subText) {
  let eta = ''
  let remaining = ''
  for (const part of normalise(subText).split('·').map((p) => p.trim())) {
    const etaMatch = part.match(/^(.+?)\s+ETA$/i)
    if (etaMatch) eta = etaMatch[1]
    else if (/\d\s*(min|hr|h|d)\b/i.test(part)) remaining = part
  }
  return { eta, remaining }
}
