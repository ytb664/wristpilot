# 03: Turn Card from the Guidance core

**What to build:** During a Navigation Session the watch shows a real Turn Card instead of raw text: distance to the Maneuver in large digits, the street it leads onto, and a small trip line with arrival time and time remaining. The arrow is a generic arrow for now, with the instruction text under it. The watch shows the Waiting Screen when no Navigation Session is running, "Arrived" for a few seconds on arrival, and goes straight to the Waiting Screen on cancel. A waypoint arrival in a multi-stop route does not end the session. All of this logic lives in the Guidance core, tested with hand-written snapshot sequences now and real recordings in ticket 09.

**Blocked by:** 02 (Drive recording).

**Status:** ready-for-agent

- [ ] Built test-first through the Guidance core seam only: tests replay small hand-written snapshot sequences (shaped like what Google Maps sends: distance in the title, turn and street in the text) and assert the sequence of Turn Card Views. Real recordings are added as fixtures in ticket 09.
- [ ] Session tracking: session starts on the first navigation snapshot; ends on removal (cancel → Waiting Screen) or arrival ("Arrived" for a few seconds, then Waiting Screen); waypoint arrival keeps the session going.
- [ ] Distance parsed from English instruction text ("in 200 m", "350 m", "1.2 km"); when absent, no distance is shown rather than a guess.
- [ ] Street parsed and passed through; the watch truncates long names cleanly on the round screen.
- [ ] Trip line parsed (e.g. "13 min · 3.5 km · 14:32 ETA" → "ETA 14:32 · 13 min"); missing parts omitted.
- [ ] Non-navigation Google Maps notifications are ignored.
- [ ] Reroutes update the Turn Card to the new Maneuver.
- [ ] Watch layout on 480×480 round: arrow top, large distance, street, small trip line; readable in the Zepp simulator.
- [ ] Manual check (by the user): a real drive shows correct distance/street/ETA on the watch.

## Seen in a real recording (ticket 02, 2026-10-11)

- A Navigation Session opens with "Starting navigation…" (no text, no icon), then "0 m" + the first street before the first real distance: don't show "0 m" as if the Maneuver were here.
- Google Maps sometimes posts the same update with an empty title.
- Distances use a no-break space: "110\u00a0m".
- v3 snapshots carry `postedAt` (Google Maps' post time) as well as `at` (when the forwarder got it).
