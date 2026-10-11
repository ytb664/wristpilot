# 09: Real drives and fixtures

**What to build:** Once tickets 03–08 and 10 are built, the user records real drives with the Android forwarder's "Record drive" switch (ticket 02) and checks everything on the road at once. The recordings become the Guidance core's fixtures: every rule that was tested with hand-written snapshot sequences is re-checked against real Google Maps data, and anything real drives reveal is fixed with a new test case.

**Blocked by:** 03, 04, 05, 06, 07, 08, 10 (the user finishes every ticket before driving).

**Status:** in-progress

- [x] **Needs the user:** record real drives covering: normal multi-turn drive, icon-only instruction ("40 m" + street, no turn word), reroute, roundabout, highway ramp/merge, arrival, cancel, multi-stop route. The agent must stop and ask the user to do this.
  _2026-10-11: five drives recorded (multi-turn, "40 m" + street, reroute, arrival). The user decided: roundabout, highway ramp/merge, cancel and multi-stop are recorded later, only if one of them shows a problem on a normal drive; until then the Guidance core stays as it is._
- [ ] Recordings are trimmed if huge and the fixtures are committed in `zepp/app-side/guidance-core/fixtures/` with the index filled in.
- [ ] **No real place in the repo.** The recordings start and end at the user's home and the GitHub repo is public, so every street, place and address in a fixture (the `text`, `title` and `textLines` fields, and destination names) is replaced with a made-up one before it is committed, consistently within a fixture so Maneuver identity still works. Hand-written tests and docs use made-up streets too (`Jl. Alpha`, `Jl. Bravo Raya`, …). The raw recordings stay uncommitted (`drive-*.jsonl` is gitignored). A local pre-push hook (`.git/hooks/pre-push`, word list in `.git/private-words`, neither is pushed) refuses any push that mentions a word on the list; add new private names there when they show up.
- [ ] Guidance core tests replay each fixture through the seam and assert the Turn Card Views and Buzz commands; every mismatch with what Google Maps showed becomes a test case and is fixed.
- [ ] The manual checks still open in tickets 03–07 (listed below) are done on these drives and ticked there.
- [ ] Ticket 10's lock check (listed below) is done if the Map Mirror works unlocked and capture stops on lock, its result goes into `docs/research/map-mirror-while-locked.md`, and the check is ticked in ticket 10.
- [ ] Ticket 08's device runs (listed below) are done with the Mini Map lab build, their results go into `docs/research/mini-map-findings.md`, the Map Mirror recommendation is made final, and the checks are ticked in ticket 08.

## Checks moved here from tickets 03–08 and 10

Tickets 03–08 and 10 are marked done once everything an agent can do is built; every check that needs the user waits here, so testing happens in one go by driving.

- **03:** the Turn Card layout is readable on the watch; long street names end cleanly in "…"; a real drive shows correct distance, street and ETA; arrival shows "Arrived", cancel shows the Waiting Screen, a waypoint doesn't end the Navigation Session.
- **04:** the arrow on the watch matches Google Maps; it looks sharp, draws without a visible delay, and is readable in sunlight and at night; when Google Maps sends no arrow (e.g. "Starting navigation…") the instruction shows in its place.
- **05:** the watch plays both vibrations; they feel right and distinct. Fixtures assert the Buzz commands. Decide from the recordings whether a jump from "0 m" back up to a bigger distance with the same arrow and street (seen on Jl. Alpha in ticket 02's recording) is a new Maneuver that should buzz again (as built it isn't, so its Turn-Now Alert is likely missed).
- **06:** screen stays on and Wristpilot stays open through a whole drive (never back to the watch face; a stray swipe doesn't close it); normal screen-off returns after arrival or cancel; Bluetooth off on the phone shows the Stale Turn Card (clearly greyed, "Disconnected" readable) within about 5 s, on again recovers with the right arrow; no false Stale Turn Card on a long straight road.
- **07:** first work through the HyperOS checklist on the forwarder's screen (each button opens the right page on the Redmi 13C) and switch Wristpilot on in Zepp's notification list. Then a full 20+ min drive with the phone screen off keeps guidance arriving on the watch; the forwarder's screen shows "✓ Navigating: kept awake…" during it, and its v3 recording has no "delivered N s late" snapshots; "Navigation started" reaches the watch, and whether tapping it opens Wristpilot (correct the README to match).
- **08 (Map Mirror runs):** not during the recorded drives: they need the `prototype/mini-map` build on both phone and watch (setup, run steps and results table in `docs/research/mini-map-findings.md`, "Runs on the phone and watch"; switch back to main afterwards). Find which transport the Active Max shows (png / bytes / convert, at 240); Option A runs with Google Maps navigating in front at **480** and **240 shown at 480** (tune the crop to map only first): fps, lag, bytes, battery over ~15 min, and whether the route line and street names read at a glance; whether Google Maps captures (not black) on HyperOS 2 and what the consent dialog offers; lock the phone mid-run: does capture stop, and resume after unlocking without new consent; Option B seen on the watch once.
- **10 (Map Mirror while locked):** only if the 08 runs show the Map Mirror works with the phone unlocked **and** capture stops when the phone locks. The steps are in `docs/research/map-mirror-while-locked.md` §4 item 2 (the developer switch is in §2.4). Pass: ask the user about an ADR and a prototype ticket. Fail: the Map Mirror stays unlocked-only.

## Found on the drives

- **2026-10-11, first drives on `main`:** distance and street were right but no turn showed: the watch drew no arrow (CANVAS `drawRect` takes corners, not x/y/w/h) and, thinking one was shown, hid the instruction. Fixed in `81a1617`; the user then confirmed the arrows show and "the direction works perfectly". Ticket 04's sharpness, delay and sunlight/night checks are still to be reported.
- **Added at the user's request:** the watch's time and battery on a grey line at the top of every Wristpilot screen (`zepp/page/status-line.js`), since Wristpilot covers the watch face for the whole drive. To check on the watch: it reads at a glance, isn't clipped by the round edge, follows the watch's 12/24-hour setting and updates each minute.
