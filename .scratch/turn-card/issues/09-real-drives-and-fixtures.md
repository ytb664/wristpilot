# 09: Real drives and fixtures

**What to build:** Once tickets 03–07 are built, the user records real drives with the Android forwarder's "Record drive" switch (ticket 02) and checks everything on the road at once. The recordings become the Guidance core's fixtures: every rule that was tested with hand-written snapshot sequences is re-checked against real Google Maps data, and anything real drives reveal is fixed with a new test case.

**Blocked by:** 03, 04, 05, 06, 07.

**Status:** ready-for-agent

- [ ] **Needs the user:** record real drives covering: normal multi-turn drive, icon-only instruction ("40 m" + street, no turn word), reroute, roundabout, highway ramp/merge, arrival, cancel, multi-stop route. The agent must stop and ask the user to do this.
- [ ] Recordings are trimmed if huge, any personal home/work addresses the user wants hidden are noted, and the fixtures are committed in `zepp/app-side/guidance-core/fixtures/` with the index filled in.
- [ ] Guidance core tests replay each fixture through the seam and assert the Turn Card Views and Buzz commands; every mismatch with what Google Maps showed becomes a test case and is fixed.
- [ ] The manual checks still open in tickets 03–07 (listed below) are done on these drives and ticked there.

## Checks moved here from tickets 03–07

Tickets 03–07 are marked done once everything an agent can do is built; every check that needs the user waits here, so testing happens in one go by driving.

- **03:** the Turn Card layout is readable on the watch; long street names end cleanly in "…"; a real drive shows correct distance, street and ETA; arrival shows "Arrived", cancel shows the Waiting Screen, a waypoint doesn't end the Navigation Session.
- **04:** the arrow on the watch matches Google Maps; it looks sharp, draws without a visible delay, and is readable in sunlight and at night; when Google Maps sends no arrow (e.g. "Starting navigation…") the instruction shows in its place.
- **05:** the watch plays both vibrations; they feel right and distinct. Fixtures assert the Buzz commands. Decide from the recordings whether a jump from "0 m" back up to a bigger distance with the same arrow and street (seen on Jl. Alpha in ticket 02's recording) is a new Maneuver that should buzz again (as built it isn't, so its Turn-Now Alert is likely missed).
- **06:** screen stays on and Wristpilot stays open through a whole drive (never back to the watch face; a stray swipe doesn't close it); normal screen-off returns after arrival or cancel; Bluetooth off on the phone shows the Stale Turn Card (clearly greyed, "Disconnected" readable) within about 5 s, on again recovers with the right arrow; no false Stale Turn Card on a long straight road.
- **07:** a full 20+ min drive with the phone screen off keeps guidance arriving on the watch; whether tapping "Navigation started" on the watch opens Wristpilot.
