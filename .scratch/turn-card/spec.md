---
title: Turn Card (Wristpilot v1)
labels: [ready-for-agent]
status: open
created: 2026-10-11
---

# Turn Card (Wristpilot v1)

## Problem Statement

When I drive with Google Maps navigation running on my Android phone (Xiaomi Redmi 13C, HyperOS 2, Android 15), I have to look away from the road at the phone to see the next turn and how far away it is. I wear an Amazfit Active Max (Zepp OS, round 480×480 AMOLED) that is paired with that phone, but nothing on the watch tells me where to turn. I want the next turn on my wrist, readable at a glance, and I want the watch to tell me by vibration when a turn is coming, so I can keep my eyes on the road.

## Solution

Wristpilot shows the Navigator's (Google Maps') current Maneuver on the watch as a Turn Card: a large turn arrow, the distance to the turn, the street it leads onto, and a small line with arrival time and time remaining. It buzzes once when a new Maneuver appears and gives a Turn-Now Alert (double buzz) about 100 m before the turn. The screen stays on for the whole Navigation Session.

I keep using Google Maps exactly as I do today. A small Wristpilot Android app reads Google Maps' navigation notification and forwards it; Wristpilot never plans routes (see ADR 0001). When navigation starts, the watch receives a "Navigation started" notification I can tap to open Wristpilot; I can also open it from a button shortcut. When no Navigation Session is running the watch shows the Waiting Screen; on arrival it shows "Arrived" briefly; if the watch loses contact with the Navigation Phone it shows a Stale Turn Card.

## User Stories

### Starting a Navigation Session

1. As a driver, I want to start directions in Google Maps exactly as I always do, so that I don't have to learn a new navigation app.
2. As a driver, I want the watch to receive a "Navigation started" notification when Google Maps begins giving directions, so that I'm reminded to open Wristpilot.
3. As a driver, I want tapping that notification to open Wristpilot on the watch (if Zepp OS allows it), so that opening it takes one tap.
4. As a driver, I want to open Wristpilot from a watch button shortcut, so that I have a reliable way to open it before driving even if the notification can't launch it.
5. As a driver, I want to open Wristpilot before I start directions and see the Waiting Screen, so that I know it is ready.
6. As a driver, I want the Waiting Screen to switch to the Turn Card by itself as soon as the Navigation Session starts, so that I don't have to touch the watch while driving.
7. As a driver, I want to open Wristpilot after a Navigation Session has already started and immediately see the current Maneuver, so that the order I open things in doesn't matter.

### Reading the Turn Card

8. As a driver, I want a large turn arrow at the top of the Turn Card, so that I can recognise the turn in a fraction of a second.
9. As a driver, I want the arrow to match the one Google Maps shows (left, right, slight, sharp, U-turn, keep left/right, roundabout, merge, ramp, straight, arrive), so that the watch and the phone never disagree.
10. As a driver, I want a plain generic arrow plus the instruction text when Wristpilot can't recognise Google Maps' arrow, so that I still get guidance for unusual maneuvers.
11. As a driver, I want the distance to the turn in large digits (for example "350 m" or "1.2 km"), so that I can judge when to turn.
12. As a driver, I want the distance to count down as I drive, so that the Turn Card stays current between Maneuvers.
13. As a driver, I want the street name the Maneuver leads onto, so that I can confirm I'm turning onto the right road.
14. As a driver, I want long street names truncated cleanly to fit the round screen, so that the layout never breaks.
15. As a driver, I want a small line at the bottom with arrival time and time remaining (for example "ETA 14:32 · 12 min"), so that I know how long the trip still takes without looking at the phone.
16. As a driver, I want the Turn Card to work when Google Maps sends only a distance and a street with no turn word, so that icon-only instructions still show the correct turn.
17. As a driver, I want the Turn Card to update when Google Maps reroutes, so that I follow the new route, not the old one.
18. As a driver, I want the Turn Card readable in bright sunlight and at night, so that it works on every drive.

### Alerts

19. As a driver, I want one short buzz when a new Maneuver appears, so that I know the instruction changed without looking.
20. As a driver, I want a Turn-Now Alert (double buzz) about 100 m before the Maneuver, so that I know it's time to turn.
21. As a driver, I want each alert to fire only once per Maneuver, so that the watch doesn't keep buzzing as Google Maps re-posts its notification every 10–20 m.
22. As a driver, I want no Turn-Now Alert when a new Maneuver is already closer than 100 m when it appears, only the new-Maneuver buzz, so that I don't get two alerts at once.
23. As a driver, I want no buzz for distance-only updates, so that buzzes always mean something.

### Screen

24. As a driver, I want the screen to stay on for the whole Navigation Session, so that I can read it without lifting my wrist from the wheel.
25. As a driver, I want Wristpilot to stay open during the Navigation Session even if the screen is touched or the wrist drops, so that the Turn Card doesn't disappear mid-drive.
26. As a watch owner, I want normal screen-off behaviour to return when the Navigation Session ends, so that the battery isn't wasted afterwards.

### Ending and edge states

27. As a driver, I want "Arrived" shown for a few seconds when I reach the destination, then the Waiting Screen, so that the end of the trip is clear.
28. As a driver, I want the Waiting Screen shown when I cancel directions in Google Maps, so that the watch never shows guidance for a route I'm no longer following.
29. As a driver, I want the watch to show a Stale Turn Card (greyed out, with a "disconnected" mark) when it stops hearing from the Navigation Phone for a few seconds, so that I never trust an out-of-date instruction.
30. As a driver, I want the Turn Card to return to normal automatically when the connection comes back, so that I don't have to do anything.
31. As a driver, I want Wristpilot to handle a multi-stop route (arriving at a waypoint and continuing), so that a stop doesn't end the Navigation Session early.
32. As a driver, I want Wristpilot to ignore Google Maps notifications that aren't navigation guidance, so that unrelated alerts never appear as Maneuvers.

### Android app and phone setup

33. As the owner of the Navigation Phone, I want a simple Android app with one screen showing whether notification access is granted and whether the watch link is up, so that I can tell at a glance if Wristpilot is ready.
34. As the owner of a Redmi 13C on HyperOS 2 / Android 15, I want a setup checklist (allow restricted settings, grant notification access, autostart on, battery saver "No restrictions" for Wristpilot and Zepp, lock both apps in Recents), so that HyperOS doesn't kill Wristpilot mid-drive.
35. As the owner of the Navigation Phone, I want the Android app to keep running for a whole drive with the screen off or with Google Maps in the foreground, so that guidance never silently stops.
36. As the owner of the Navigation Phone, I want the Android app to start forwarding automatically when Google Maps navigation starts, so that I never have to open it before driving.

### Developer

37. As the developer, I want to record real Google Maps navigation notifications (text fields and arrow image) during drives on the Navigation Phone, so that I can build and test the Guidance core against real data.
38. As the developer, I want to replay recorded drives through the Guidance core without a car, so that I can check every change against real Navigation Sessions.
39. As the developer, I want to install Wristpilot on my own watch through Zepp Developer Mode and the Android app as an APK, so that I don't depend on any store review.

## Implementation Decisions

### Shape

- Three runtime parts, with almost all logic in one:
  - **Android forwarder** (Kotlin): a notification listener that watches Google Maps (package `com.google.android.apps.maps`) navigation notifications and forwards a **Raw Guidance Snapshot** for every post and removal. It holds no navigation logic. It runs a local WebSocket server on the phone (pattern proven by Ring-Map), keeps itself alive with a foreground service, posts the "Navigation started" notification, and shows the one-screen status/setup checklist.
  - **Guidance core** (JavaScript, runs in the Zepp side service): **all navigation logic**. It consumes Raw Guidance Snapshots and the clock and produces **Turn Card View** updates and **Buzz commands**. Pure and deterministic: no I/O, time is passed in.
  - **Watch app** (Zepp OS device app, API level 4.2, round 480×480): renders whatever Turn Card View it receives, plays Buzz commands, keeps the screen on during a Navigation Session, and switches to the Stale Turn Card on its own if no message arrives within a timeout.
- The side service is a thin adapter around the Guidance core: it connects to the Android forwarder's local WebSocket, feeds snapshots into the core, and sends core output to the watch with Zepp messaging.

### Raw Guidance Snapshot (Android forwarder → side service)

- Fields: event kind (posted / removed), timestamp, notification key, the Google Maps text extras as-is (title, text, big text, sub text, text lines), whether the notification is ongoing, its category, and the large icon (the Maneuver arrow) as a small fixed-size bitmap (downscaled, e.g. 48×48, as raw pixels or a compact grayscale/alpha encoding).
- The forwarder never interprets the text or the icon. The format is versioned so recorded fixtures stay readable.
- The same format is used for **drive recordings**: the forwarder can save every snapshot of a drive to a file for use as a test fixture.

### Guidance core behaviour

- **Session tracking:** a Navigation Session starts with the first Google Maps navigation snapshot and ends when the notification is removed or arrival is detected. Arrival yields an "Arrived" view for a few seconds, then the Waiting Screen. Removal without arrival (cancel) goes straight to the Waiting Screen. A waypoint arrival during a multi-stop route does not end the session.
- **Maneuver recognition:** the turn is classified from the arrow icon (following the approach in starpath, which classifies Google Maps' large icon because the text is often icon-only). The text is a fallback (English only, since the Navigator runs in English). Anything unrecognised becomes a generic arrow plus the instruction text.
- **Maneuver kinds** (initial set): straight, slight left/right, left/right, sharp left/right, U-turn, keep left/right, merge, ramp left/right, roundabout (with exit number when available in text), arrive, unknown.
- **Deduplication:** a Maneuver is identified by kind + street + session. Re-posts that only change the distance update the view but never count as a new Maneuver.
- **Distance:** parsed from the instruction text ("in 200 m", "350 m", "1.2 km"), metric units as Google Maps shows them. If the text has no distance, show none rather than guess.
- **Trip line:** arrival time and time remaining parsed from the trip line (e.g. "13 min · 3.5 km · 14:32 ETA"). Missing parts are omitted.
- **Buzz rules:** one short buzz per new Maneuver; one Turn-Now Alert per Maneuver when the distance first drops to 100 m or below; no Turn-Now Alert if the Maneuver appears already at or under 100 m; never buzz on distance-only updates.
- **Turn Card View** (core → watch): screen kind (waiting / turn / arrived), Maneuver kind, distance text, street text, trip line text, and fallback instruction text for unknown Maneuvers. The watch does no parsing.

### Watch app

- Layout on the round 480×480 screen, top to bottom: large arrow (bundled images, one per Maneuver kind), large distance digits, street name (truncated to fit), small trip line.
- Arrow images ship inside the watch app; no images are sent at runtime in v1.
- During a Navigation Session: keep the page bright and pause wrist-drop screen-off; set relaunch-on-wake so the app isn't closed when the screen dims. Restore defaults when the session ends.
- Buzzes use the Zepp OS vibrator (custom step patterns are available from API 3.6; short single for a new Maneuver, double for the Turn-Now Alert).
- Stale Turn Card: if no message arrives for a few seconds (target 5 s, tune on real drives), grey out the current Turn Card and add a "disconnected" mark; clear it on the next message.

### Opening Wristpilot

- No API to open the watch app from the phone was found. The Android forwarder posts a phone notification "Navigation started" when a session begins, which Zepp mirrors to the watch. Whether tapping it can open Wristpilot is unverified; if not, it is only a reminder. A watch button shortcut to Wristpilot is the backup.

### Distribution

- Personal use: watch app installed via Zepp Developer Mode (`zeus preview`), Android app as a sideloaded debug APK. No store listing. Target deviceSource ids for the Active Max: 10813697 and 10813699.

## Testing Decisions

- **One seam: the Guidance core.** Tests feed it a sequence of Raw Guidance Snapshots with timestamps and assert only its outputs: the sequence of Turn Card Views and Buzz commands. Tests never reach into the core's internal state, classifier internals, or parsing helpers.
- **Fixtures are real drive recordings** captured on the Redmi 13C with the Android forwarder's recording mode, trimmed and committed. They must cover at least: a normal multi-turn drive, icon-only instructions ("40 m" + street with no turn word), repeated re-posts every 10–20 m, a reroute, a roundabout, a highway ramp/merge, arrival, cancel, and a multi-stop route. Small hand-written snapshot sequences are fine for single-rule cases (e.g. the Turn-Now Alert not firing when a Maneuver appears under 100 m).
- **Arrow recognition** is tested through the same seam: recorded snapshots with known turns must produce the expected Maneuver kind in the Turn Card View.
- **Watch app:** only the stale-timeout behaviour is tested (messages in, elapsed time → stale or not). Rendering is checked by eye in the Zepp simulator and on the watch.
- **Android forwarder:** no automated tests; it holds no logic. Checked manually on the Redmi against the setup checklist and a real drive.
- **Prior art:** none in this repo yet (it's empty). starpath's parser and dedup code and Ring-Map's WebSocket bridge are references for behaviour, not test structure.
- A good test reads like a drive: "given these notifications at these times, the watch shows this and buzzes like this."

## Out of Scope

- The Mini Map (screen mirror or self-drawn map). It gets its own prototype ticket, judged by: at least one update every 2 s, no more than about 2 s lag, and readable at a glance on 480×480. If that fails, a self-drawn map without a route line; if both fail, no Mini Map.
- Sending Google Maps' own arrow images to the watch (possible later if the Mini Map prototype shows image transfer is fast).
- iPhone support (impossible, see ADR 0001 and the research report).
- Any routing of our own, or any Navigator other than Google Maps.
- Languages other than English for the Navigator's text.
- Lane guidance, speed limits, speed-dependent Turn-Now Alert distance.
- Publishing to the Zepp app store or Google Play.

## Further Notes

- **Biggest risk:** HyperOS 2 killing the Android forwarder or the Zepp app (and with it the side service) during a drive. The setup checklist and a foreground service are the mitigations; a full real drive with the screen off is the acceptance test.
- **Unverified:** whether the Zepp side service keeps running while the Zepp app is in the background on Android; whether a notification tap can open a Zepp OS mini program; the Google Maps notification update rate on this phone (starpath reports every 10–20 m).
- Android 15 blocks notification access for sideloaded apps until "Allow restricted settings" is enabled in the app's info screen; the setup checklist must say so.
- Research: the iPhone feasibility report in the research docs folder; ADR 0001 for why Wristpilot mirrors Google Maps on Android.
