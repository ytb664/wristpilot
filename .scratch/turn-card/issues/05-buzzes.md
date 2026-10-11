# 05: Buzzes

**What to build:** The watch buzzes so I don't have to look: one short buzz when a new Maneuver appears, and a Turn-Now Alert (double buzz) when the distance first drops to 100 m or below. Each fires once per Maneuver. Distance-only updates never buzz, even though Google Maps re-posts its notification every 10–20 m. If a new Maneuver appears already at or under 100 m, only the new-Maneuver buzz fires.

**Blocked by:** 03 (Turn Card from the Guidance core).

**Status:** in-progress

- [x] Built test-first through the Guidance core seam: tests assert the Buzz command sequence for hand-written edge cases, including one shaped like the recorded drive's start (ticket 02's recording).
- [ ] Buzz commands asserted for committed drive recordings. _(checked in ticket 09: the fixtures are committed there)_
- [x] Maneuver identity = arrow image + street + session, so re-posts never count as a new Maneuver. (The turn text is part of it too, as built in ticket 03: without an arrow it is the only thing that tells two Maneuvers on one street apart.)
- [x] Rules covered by tests: new-Maneuver buzz once; Turn-Now Alert once at ≤100 m; no Turn-Now Alert when a Maneuver appears at ≤100 m; no buzz on distance-only updates; reroute to a different Maneuver counts as new.
- [x] Watch code plays a short single vibration (`STRONG_SHORT`) and a distinct double vibration (`STRONG_SHORT`, pause 150 ms, `STRONG_SHORT`) through the Zepp OS vibrator's step patterns (API ≥ 3.6); `zeus build` passes.
- [ ] Manual check (by the user): the watch actually plays both vibrations. _(checked in ticket 09)_
- [ ] Manual check (by the user): buzzes feel right and distinct on a real drive. _(checked in ticket 09)_

## How the Guidance core buzzes (built 2026-10-11)

- Buzz commands are `'newManeuver'` and `'turnNow'`; the side service sends each to the watch as a `turnCard.buzz` call. A watch that isn't open misses them (nothing is queued).
- "Starting navigation…" is Google Maps' placeholder, not a Maneuver to buzz for; the first real Maneuver is. A Maneuver with only a turn ("Head north") does buzz.
- "Appears at ≤100 m" means the distance is within reach in the same post as the new-Maneuver buzz: the two would come at once. Google Maps' opening "0 m" isn't shown (ticket 03), so a Maneuver that opens at "0 m" (e.g. while parked) and later shows "90 m" gets its Turn-Now Alert then.
- The double vibration is two plain short buzzes rather than a named scene like `URGENT`, which may be a pattern of its own; the difference is the count. Tune on the drive in ticket 09.
- Empty-title re-posts never buzz, even with the previous Maneuver's arrow.
- Seen when replaying ticket 02's recording: on Jl. Alpha, Google Maps went "0 m" → "100 m" with the same arrow and street. By the identity rule that is the same Maneuver, so neither buzz fires again, though it was probably a second turn: likely a missed Turn-Now Alert. Left for ticket 09's recordings to decide, since it changes the identity rule above.
