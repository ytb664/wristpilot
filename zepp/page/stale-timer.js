// When the watch stops trusting the Turn Card: no message from the Navigation Phone (a view,
// a buzz or the side service's heartbeat) for STALE_AFTER_MS. Time is passed in.
//
// heard(now) for each message; it returns true when the message ends a silence, so the page
// can ask for the full Turn Card again. isStale(now) says whether to show the Stale Turn Card.

// Tune on real drives (ticket 09). The side service's heartbeat must come well inside it.
export const STALE_AFTER_MS = 5000

export function createStaleTimer({ staleAfterMs = STALE_AFTER_MS } = {}) {
  let lastHeard = null // nothing heard yet: nothing to distrust

  function isStale(now) {
    return lastHeard !== null && now - lastHeard >= staleAfterMs
  }

  return {
    heard(now) {
      const wasStale = isStale(now)
      lastHeard = now
      return wasStale
    },
    isStale,
  }
}
