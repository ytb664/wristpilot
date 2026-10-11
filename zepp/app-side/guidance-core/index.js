// Guidance core: all navigation logic lives here.
// Seam: Raw Guidance Snapshots + time in -> Turn Card View + Buzz commands out.
// Pure and deterministic: no I/O, time is passed in.
//
// receive(snapshot, now) for each Raw Guidance Snapshot; tick(now) when time passes without one.
// Both return { view, buzzes }. view is null when the watch should stay as it is.

// How long "Arrived" stays up before the Waiting Screen.
export const ARRIVED_MS = 5_000

export function createGuidanceCore() {
  let shown = null // the last Turn Card View sent to the watch
  let current = null // the Maneuver on the Turn Card: { id, distance, counting }
  let arrivedAt = null // when "Arrived" went up, while it is up

  function show(view) {
    if (sameView(view, shown)) return { view: null, buzzes: [] }
    shown = view
    return { view, buzzes: [] }
  }

  return {
    receive(snapshot, now) {
      if (!isGuidance(snapshot)) {
        return { view: null, buzzes: [] }
      }
      if (snapshot.event === 'removed') {
        current = null
        // Google Maps removes its notification both on arrival and on cancel. Only the
        // trip line tells them apart: nothing left to drive means we arrived. Arriving at a
        // waypoint looks the same, so a new Maneuver during "Arrived" carries the session on.
        if (!isArrival(snapshot)) return show({ screen: 'waiting' })
        arrivedAt = now
        return show({ screen: 'arrived' })
      }
      arrivedAt = null
      const title = withoutDistance(normalise(snapshot.title))
      const text = withoutDistance(normalise(snapshot.text))
      const { instruction, street } = maneuver(text.rest)
      const id = `${instruction}\n${street}`
      if (!current || current.id !== id) current = { id, distance: '', counting: false }
      const distance = title.distance || text.distance
      if (distance && !isZero(distance)) current.counting = true
      // Google Maps opens a Maneuver at "0 m" before its first real distance: that is not
      // "the turn is here". An empty title re-posts the same update: keep the distance.
      if (distance && (current.counting || !isZero(distance))) current.distance = distance
      return show({
        screen: 'turn',
        distance: current.distance,
        street,
        instruction: instruction || title.rest,
        tripLine: tripLine(snapshot.subText),
      })
    },

    tick(now) {
      if (arrivedAt === null || now - arrivedAt < ARRIVED_MS) return { view: null, buzzes: [] }
      arrivedAt = null
      return show({ screen: 'waiting' })
    },
  }
}

function sameView(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}

// Unverified on the Navigation Phone whether Google Maps sets the navigation
// category, so its ongoing notification counts too.
function isGuidance(snapshot) {
  return snapshot.category === 'navigation' || snapshot.ongoing === true
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
  if (bare) return { distance: `${bare[1]} ${bare[2].toLowerCase()}`, rest: '' }
  const phrase = line.match(new RegExp(String.raw`\s*\bin ${DISTANCE},?\s*`, 'i'))
  if (!phrase) return { distance: '', rest: line }
  const rest = (line.slice(0, phrase.index) + ' ' + line.slice(phrase.index + phrase[0].length)).trim()
  return { distance: `${phrase[1]} ${phrase[2].toLowerCase()}`, rest: capitalise(rest) }
}

function isZero(distance) {
  return parseFloat(distance) === 0
}

function capitalise(text) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

// "Turn right onto Jl. Sudirman" -> instruction "Turn right", street "Jl. Sudirman".
// Google Maps often sends the street alone (the arrow shows the turn): no instruction then.
function maneuver(text) {
  // Without a turn before it, "toward Jl. H. Foxtrot" is the street line itself.
  const match = text.match(/^(.+?)\s+(?:onto|on|toward|towards)\s+(.+)$/i)
  if (!match) return { instruction: '', street: text }
  return { instruction: match[1], street: match[2] }
}

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
