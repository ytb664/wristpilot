# 09: Real drives and fixtures

**What to build:** Once tickets 03–07 are built, the user records real drives with the Android forwarder's "Record drive" switch (ticket 02) and checks everything on the road at once. The recordings become the Guidance core's fixtures: every rule that was tested with hand-written snapshot sequences is re-checked against real Google Maps data, and anything real drives reveal is fixed with a new test case.

**Blocked by:** 03, 04, 05, 06, 07.

**Status:** ready-for-agent

- [ ] **Needs the user:** record real drives covering: normal multi-turn drive, icon-only instruction ("40 m" + street, no turn word), reroute, roundabout, highway ramp/merge, arrival, cancel, multi-stop route. The agent must stop and ask the user to do this.
- [ ] Recordings are trimmed if huge, any personal home/work addresses the user wants hidden are noted, and the fixtures are committed in `zepp/app-side/guidance-core/fixtures/` with the index filled in.
- [ ] Guidance core tests replay each fixture through the seam and assert the Turn Card Views and Buzz commands; every mismatch with what Google Maps showed becomes a test case and is fixed.
- [ ] The manual checks still open in tickets 03–07 are done on these drives and ticked there.
