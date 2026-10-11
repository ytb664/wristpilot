# 05: Buzzes

**What to build:** The watch buzzes so I don't have to look: one short buzz when a new Maneuver appears, and a Turn-Now Alert (double buzz) when the distance first drops to 100 m or below. Each fires once per Maneuver. Distance-only updates never buzz, even though Google Maps re-posts its notification every 10–20 m. If a new Maneuver appears already at or under 100 m, only the new-Maneuver buzz fires.

**Blocked by:** 03 (Turn Card from the Guidance core).

**Status:** ready-for-agent

- [ ] Built test-first through the Guidance core seam: tests assert the Buzz command sequence for recorded drives and hand-written edge cases.
- [ ] Maneuver identity = arrow image + street + session, so re-posts never count as a new Maneuver.
- [ ] Rules covered by tests: new-Maneuver buzz once; Turn-Now Alert once at ≤100 m; no Turn-Now Alert when a Maneuver appears at ≤100 m; no buzz on distance-only updates; reroute to a different Maneuver counts as new.
- [ ] Watch plays a short single vibration and a distinct double vibration using the Zepp OS vibrator (custom step patterns, API ≥ 3.6).
- [ ] Manual check (by the user): buzzes feel right and distinct on a real drive.
