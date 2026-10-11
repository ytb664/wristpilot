# 03: Turn Card from the Guidance core

**What to build:** During a Navigation Session the watch shows a real Turn Card instead of raw text: distance to the Maneuver in large digits, the street it leads onto, and a small trip line with arrival time and time remaining. The arrow is a generic arrow for now, with the instruction text under it. The watch shows the Waiting Screen when no Navigation Session is running, "Arrived" for a few seconds on arrival, and goes straight to the Waiting Screen on cancel. A waypoint arrival in a multi-stop route does not end the session. All of this logic lives in the Guidance core, tested with hand-written snapshot sequences now and real recordings in ticket 09.

**Blocked by:** 02 (Drive recording).

**Status:** in-progress

- [x] Built test-first through the Guidance core seam only: tests replay small hand-written snapshot sequences (shaped like what Google Maps sends: distance in the title, turn and street in the text) and assert the sequence of Turn Card Views. Real recordings are added as fixtures in ticket 09.
- [x] Session tracking: session starts on the first navigation snapshot; ends on removal (cancel → Waiting Screen) or arrival ("Arrived" for a few seconds, then Waiting Screen); waypoint arrival keeps the session going.
- [x] Distance parsed from English instruction text ("in 200 m", "350 m", "1.2 km"); when absent, no distance is shown rather than a guess.
- [ ] Street parsed and passed through; the watch truncates long names cleanly on the round screen. _(Parsing done and tested. Truncation is Zepp's ELLIPSIS text style and not yet seen on a screen: there is no Zepp simulator on this Mac, so the user checks it in the simulator or on the watch.)_
- [x] Trip line parsed (e.g. "13 min · 3.5 km · 14:32 ETA" → "ETA 14:32 · 13 min"); missing parts omitted.
- [x] Non-navigation Google Maps notifications are ignored.
- [x] Reroutes update the Turn Card to the new Maneuver.
- [ ] Watch layout on 480×480 round: arrow top, large distance, street, small trip line; readable in the Zepp simulator. _(Built and `zeus build` passes; not yet looked at: needs the user, in the simulator or on the watch.)_
- [ ] Manual check (by the user): a real drive shows correct distance/street/ETA on the watch. _(checked in ticket 09)_

## Seen in a real recording (ticket 02, 2026-10-11)

- A Navigation Session opens with "Starting navigation…" (no text, no icon), then "0 m" + the first street before the first real distance: don't show "0 m" as if the Maneuver were here.
- Google Maps sometimes posts the same update with an empty title.
- Distances use a no-break space: "110\u00a0m".
- v3 snapshots carry `postedAt` (Google Maps' post time) as well as `at` (when the forwarder got it).

## How the Guidance core reads Google Maps (built 2026-10-11)

Rules taken from the recording above, for ticket 09's fixtures to confirm or correct:

- **Guidance** is a Google Maps notification with the `navigation` category (the recording's guidance notification has it). Other ongoing Google Maps notifications are ignored, and so are removals of any notification other than the running Navigation Session's.
- **Arrival vs cancel:** Google Maps removes its notification in both cases. A removal whose trip line says "0 min" is an arrival ("Arrived" for 5 s, then the Waiting Screen); anything else is a cancel. A cancel within the last minute therefore shows "Arrived".
- **Waypoints:** a new Maneuver while "Arrived" is up carries the session on. Unverified: how Google Maps behaves at a real waypoint (the 15:58 removal at "0 min · 100 m" followed by a new "Starting navigation…" in the recording may be one).
- **"Starting navigation…"** shows as the instruction under the arrow until the first Maneuver arrives.
- **Empty-title re-posts** keep the Maneuver's last distance (same update, per the note above); a new Maneuver never inherits one.
