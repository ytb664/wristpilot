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
      if (snapshot.category !== 'navigation') {
        return { view: null, buzzes: [] }
      }
      if (snapshot.event === 'removed') {
        return { view: { screen: 'waiting' }, buzzes: [] }
      }
      return {
        view: { screen: 'turn', instructionText: snapshot.title },
        buzzes: [],
      }
    },
  }
}
