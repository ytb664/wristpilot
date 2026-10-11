# Mini Map: how to make it (ticket 08 findings)

Status: **desk findings done; device measurements pending** (see "Runs on the phone and watch"). The recommendation below is provisional until those runs are filled in.

> **Changed 2026-10-11:** the Mini Map is dropped in favour of the **Map Mirror**: a full-screen (480×480) view of Google Maps' map around the car, copied by screen capture (Option A only), that the driver taps to from the Turn Card. If capture doesn't work on the Redmi, there's no full-screen map (Option B isn't a fallback: no route line). It runs only while the phone is unlocked; locked-phone mirroring via Android Auto is ticket 10. The runs below gain a 480 px and a 240-shown-at-480 frame size; the bar for full-screen frames is set once they're in. The Mini Map text below is kept as it was measured.

The question: should the Mini Map mirror Google Maps' screen (Option A: Android screen capture → crop/scale → watch) or draw our own map around the driver (Option B: phone GPS + map tiles, heading-up, no route line)? The bar (spec, Out of Scope): **at least one update every 2 s, no more than ~2 s lag, readable at a glance on 480×480 in the bottom two-thirds circle.** A wins if it meets it; otherwise B; if neither, no Mini Map.

The prototype lives on branch `prototype/mini-map` (never merged): a Mini Map lab screen in the Android forwarder, a frame pump in the side service, and a lab page on the watch. See "The prototype" at the end.

## What a frame costs

A Mini Map frame is a 240×240 circle. Measured on the desk with a real OSM frame of central Jakarta (z16, rotated 30° for heading-up):

| Encoding | Bytes per frame |
|---|---|
| Android `Bitmap.compress` PNG (truecolour) | ~88–91 KB |
| Palette PNG, 216 colours (lab default, `IndexedPng`) | 12.7 KB |
| Palette PNG, 64 colours | 10.8 KB |
| Palette PNG, 27 colours | 9.3 KB |
| JPEG q80 / q60 | 14.8 KB / 9.9 KB |
| **Watch's native image** (what `zeus build`'s PNG→TGA makes; `image.convert` is documented to do the same job) | **58,688 B, always** |

The watch's native format is an uncompressed 8-bit palette TGA (type 1, 256×32-bit palette, 46-byte "SOMH" id): 240×240 + 1 KB palette + header, **whatever the picture**. So:

- Converting on the phone (`image.convert`) means ~57 KB over Bluetooth per frame.
- Sending a palette PNG means ~10–13 KB, **if the watch can show a PNG written at runtime**. Zepp's docs say device apps can't show PNG (hence `image.convert`); one community project shows runtime PNGs from `data://` working, but only in the Zepp OS 5 emulator. Unverified on API 4.2 / the Active Max: the lab tests it.
- Android's own PNG encoder is out: 7× bigger than a palette PNG. Rotation's smoothing creates thousands of colours; a fixed palette of 216 brings it back.

### Map Mirror frames (480×480)

Measured on the desk the same way (`zeus build` for the native format, the lab's own `IndexedPng` for palette PNGs). Two 480 frames bracket what Option A would send: an OSM frame at z16 covering 4× the area of the 240 one (dense detail: an upper estimate), and the 240 frame scaled up to 480 (no new detail: a lower bound). Google Maps' driving style is flatter than OSM's (fewer labels, plain fills), so real captures probably sit nearer the lower bound; the runs measure them.

| Encoding | 480, OSM, 4× area | 480, the 240 frame scaled up |
|---|---|---|
| Truecolour PNG (sharp, level 9) | 356 KB | |
| Palette PNG, 216 colours (lab default) | **46.8 KB** | **32.3 KB** |
| Palette PNG, 64 / 27 colours | 40.6 / 35.6 KB | 28.4 / 24.0 KB |
| JPEG q80 / q60 | 58.8 / 39.2 KB | |
| **Watch's native image** (TGA from `zeus build`) | **231,488 B, always** | same |

- The native TGA is 480×480 + 1 KB palette + 64-byte header, exactly as predicted from the 240 one; checked with a real `zeus build`. `image.convert` at 480 means ~226 KB per frame: ~29 s at 8 KB/s. Out.
- A 480 palette PNG is 2.5–3.7× a 240 one: 4–6 s per frame at 8 KB/s. One update every 2 s needs the link to carry ~16–24 KB/s.
- **240 shown at 480** costs the same as a Mini Map frame (12.7 KB, ~1.6 s at 8 KB/s); the watch scales it up (IMG `auto_scale`). Whether it's sharp enough is for the wrist to judge.

Bluetooth throughput: the only figure found is ~8 KB/s (a file-transfer polyfill on Zepp OS 2). At that rate a 12.7 KB PNG is ~1.6 s and a 57 KB converted frame ~7 s: **only the PNG path (or raw bytes) can meet one update every 2 s**, and only just. The lab measures the real rate.

## Option A: mirror Google Maps' screen

From Android's docs (research, not yet tried on the Redmi):

- Every capture session needs the user's consent in a system dialog; the consent token works once. On Android 14 QPR2+ the dialog offers "a single app" or "entire screen"; picking Google Maps captures just its window.
- **Android 15 QPR1+ stops the capture when the screen locks.** A screen lock or timeout mid-drive ends the Mini Map until the user consents again on the phone. Google Maps keeps the screen on while navigating in the foreground, but a phone in a holder that locks (or one the driver locks) breaks Option A.
- Needs a foreground service of type `mediaProjection` and a status-bar chip shows while capturing.
- Whether Google Maps marks its window secure (captures black) is unknown: the lab counts all-black frames.
- What the crop shows: Google Maps' own map with its route line, at its zoom, including its UI (maneuver banner, buttons) if the crop reaches them. The lab crops a square around where Maps draws the car (centre ~62% down the screen; tunable).

## Option B: draw our own map

- Phone GPS (`LocationManager`, 1 Hz) and GPS bearing (used only above 1.5 m/s), OSM raster tiles at z16 (~570 m across the 240 px circle in Jakarta; z17 ~285 m), rotated heading-up, car drawn 62% down, no line for the way ahead.
- **Readability** (desk look at the frames): OSM's standard light style at 216 colours reads well: main roads stand out (orange/yellow), street labels are legible at 1:1. Inverting OSM for a dark watch look does **not** work: roads go dark against dark buildings. A dark Mini Map needs a tile style designed dark (e.g. Thunderforest, CARTO dark), not inversion. Rounding to 64 or 27 colours tints buildings (yellow/red speckle).
- Works with the phone screen off or locked (location foreground service), unlike Option A.

### Tile terms

- **OpenStreetMap** (tile.openstreetmap.org): a stable identifying User-Agent; cache tiles ≥ 7 days (honour headers); no prefetching of areas not being viewed; offline use not permitted; visible "© OpenStreetMap" attribution; best effort, can be blocked without notice. The lab complies: fetches only tiles in view, two at a time, caches 7 days, draws the attribution on the frame. Fine for one personal device; not something to lean on long term.
- **Mapbox: ruled out.** Its ToS needs a separate commercial licence for any application "related to vehicle usage", even in development; its product terms also forbid distributing map content as a screenshot/static image (which pushing frames to the watch is). Free tiers otherwise: Raster Tiles 750k/month, Static Tiles 200k/month.
- Alternatives for personal use: Thunderforest Hobby (150k tiles/month, attribution, has dark styles), MapTiler Free (100k requests/month, non-commercial, logo), Stadia Free (200k credits/month, non-commercial, no persistent caching on free).

## Runs on the phone and watch (to be filled in)

### Setup (once)

```sh
git checkout prototype/mini-map
source scripts/env.sh && cd android && ./gradlew assembleDebug && adb install -r app/build/outputs/apk/debug/app-debug.apk
cd ../zepp && npx zeus preview      # the watch app on this branch opens on the Mini Map lab page
```

Afterwards, `git checkout main` and install both again to get the normal Wristpilot back.

### Each run

1. Open Wristpilot on the watch (it shows "Mini Map lab"), then on the phone: Wristpilot → **Mini Map lab (prototype)**.
2. Pick the settings (frame size first: it applies from the next Start), then **Start A** or **Start B**. Unplug the phone.
3. On the watch, check the map appears and the **frame number at the top of the circle counts up**. That is the proof frames are really shown: the watch confirms every frame it points the image at, whether or not it could draw it. If the circle stays empty, tap the top line of the watch to try the next path form; if none shows anything, that transport doesn't work on the Active Max.
4. Let it run 15 min (for B, drive or walk; for A, Google Maps navigating in front), then **Share measurements** and paste the text into the table.

| Run | Shown on watch? (frame number counts up) | fps (last 30 s) | Lag p50 / p95 | Bytes sent / frame | Phone mAh / %, watch % (15 min) |
|---|---|---|---|---|---|
| B, png, palette 216, every 1000 ms | | | | | |
| B, bytes, palette 216 | | | | | |
| B, convert | | | | | |
| A, best transport from above | | | | | |
| A (Map Mirror), 480 px, best transport | | | | | |
| A (Map Mirror), 240 px shown at 480, best transport | | | | | |

Lag runs from the GPS fix (B) or the screen frame (A) to the watch confirming it, on the phone's clock; it includes one watch→phone message (ping shown alongside).

Map Mirror runs: the crop doesn't change with the frame size, so before the 480 runs tune **Centre height** and **Side** on the lab screen until the preview shows map only (no maneuver banner, no buttons), keeping **crop** on the status line at 480 px or more (it says "scaled up" if not). Option B at 480 keeps its zoom, so it shows 4× the area rather than a sharper map; it isn't a Map Mirror candidate anyway.

Map Mirror also: is 240-shown-at-480 sharp enough to read the route line and street names at a glance? Lock the phone mid-run: does capture stop, and does it resume after unlocking without new consent?

Option A also: what the consent dialog offers (single app?), whether frames are all black (the lab counts them; Google Maps secure window?), and what happens when the phone screen locks or goes off.

Readability, judged on the wrist in the car: can the road ahead and the next turn be read at a glance?

## Recommendation (provisional)

**Map Mirror** (what the runs now decide): screen capture only. Unless the runs show the link carrying well over 8 KB/s, 480 px frames can't update every 2 s; then the choice is **240 px frames shown at 480**, if they read at a glance on the wrist. Native TGA frames are out at either size. The steps below are the Mini Map recommendation as first written.

1. The format decides more than A vs B: frames must cross Bluetooth as ~10–13 KB palette PNGs (or raw bytes written to a file on the watch). If the Active Max can't show a runtime PNG, every frame is 57 KB and neither option meets "one update every 2 s" at the ~8 KB/s found in the research: **no Mini Map** unless the measured link is far faster.
2. If PNG works and the link sustains ≥ 1 frame / 2 s: **Option A only if** Google Maps captures (not black) and the capture survives a whole drive. Android 15 stopping it on screen lock makes that unlikely in practice; then **Option B** with OSM (light style, 216 colours, z16), switching to a dark-styled tile source if a dark look is wanted.

## The prototype (branch `prototype/mini-map`)

- Phone: Wristpilot → "Mini Map lab (prototype)". Frame size (240, 480, or 240 shown at 480; takes effect at the next Start, and reported with the measurements; A captures at full screen resolution for 480); Start A (screen capture consent) or B (location permission); interval 500/1000/2000 ms; transport png / convert / bytes; PNG colours 216/64/27/truecolour; A's crop; B's zoom and look. Shows the latest frame, the measurements, and "Share measurements".
- Forwarder ↔ side service: lab WebSocket `ws://127.0.0.1:8787` (frame announcements, reports back), frames over HTTP `127.0.0.1:8788` for the side service's downloader. Separate from the guidance link on 8786.
- Side service (`app-side/mini-map-lab.js`, `mini-map-transport.js`): one frame in flight, newest wins; times download, convert and transfer; reports each confirmed frame to the lab screen.
- Watch (`page/mini-map-lab.js`, the app's first page on the branch): stores each frame as its own file (the IMG widget caches by name), shows it at 240×240 low in the circle or full-screen at 480 (a 240 frame scaled up; tap the map to hide or show the text over it), reports back, pings every 10 s, battery every 30 s. Tap the top line to try another image path form (`data://x`, `x`, `/data/x`).
