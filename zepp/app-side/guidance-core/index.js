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

// How long "Arrived" stays up before the Waiting Screen.
const ARRIVED_MS = 5_000

const NOTHING = { view: null, buzzes: [] }

export function createGuidanceCore() {
  let shown = null // the last Turn Card View sent to the watch
  let sessionKey = null // the notification key of the running Navigation Session
  let current = null // the Maneuver on the Turn Card: { id, distance, sawRealDistance }, id = arrow + turn + street
  let arrivedAt = null // when "Arrived" went up, while it is up

  function show(view) {
    if (sameView(view, shown)) return NOTHING
    const sent = { ...view }
    if (view.arrow && shown?.screen === 'turn' && sameView(view.arrow, shown.arrow)) delete sent.arrow
    shown = view
    return { view: sent, buzzes: [] }
  }

  return {
    receive(snapshot, now) {
      if (!isGuidance(snapshot)) return NOTHING
      if (snapshot.event === 'removed') {
        if (snapshot.key !== sessionKey) return NOTHING
        sessionKey = null
        current = null
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
      const turn = instruction || title.rest
      const arrow = snapshot.icon || null
      const id = `${arrow?.data}\n${turn}\n${street}`
      if (!current || current.id !== id) current = { id, distance: '', sawRealDistance: false }
      const distance = title.distance || text.distance
      if (distance && !isZero(distance)) current.sawRealDistance = true
      // Google Maps opens a Maneuver at "0 m" before its first real distance: that is not
      // "the turn is here". An empty title re-posts the same update: keep the distance.
      if (distance && current.sawRealDistance) current.distance = distance
      return show({
        screen: 'turn',
        arrow,
        distance: current.distance,
        street,
        instruction: arrow ? '' : turn,
        tripLine: tripLine(snapshot.subText),
      })
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

function sameView(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
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

function isZero(distance) {
  return parseFloat(distance) === 0
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
