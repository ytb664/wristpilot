// Guidance core: all navigation logic lives here.
// Seam: Raw Guidance Snapshots + time in -> Turn Card View + Buzz commands out.
// Pure and deterministic: no I/O, time is passed in.
//
// Output: { view, buzzes }. view is null when the watch should stay as it is.
//
// Walking skeleton (ticket 01): the Turn Card just echoes the notification title.

export function createGuidanceCore() {
  return {
    receive(snapshot, now) {
      if (!isGuidance(snapshot)) {
        return { view: null, buzzes: [] }
      }
      if (snapshot.event === 'removed') {
        return { view: { screen: 'waiting' }, buzzes: [] }
      }
      return {
        view: { screen: 'turn', maneuverText: snapshot.title },
        buzzes: [],
      }
    },
  }
}

// Unverified on the Navigation Phone whether Google Maps sets the navigation
// category, so its ongoing notification counts too. Ticket 03 refines this
// against recorded drives.
function isGuidance(snapshot) {
  return snapshot.category === 'navigation' || snapshot.ongoing === true
}
