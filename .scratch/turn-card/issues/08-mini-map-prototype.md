# 08: Mini Map prototype

**What to build:** A throwaway prototype that answers one question: how should the Mini Map be made? Option A mirrors Google Maps' screen (Android screen capture → crop/scale → send to the watch). Option B draws our own map around the driver (phone GPS position + OpenStreetMap/Mapbox tiles, heading-up, no route line). Measure both on the real phone and watch. Lives on a `prototype/mini-map` branch, not main; its findings go into a short write-up that the follow-up Mini Map spec will reference.

_Changed 2026-10-11 (grilling session): the Mini Map is dropped in favour of the **Map Mirror**, a full-screen view of Google Maps' map that the driver taps to from the Turn Card (see `CONTEXT.md`). The device runs below now decide the Map Mirror. Decisions:_

- _Option A (screen capture) only. If Google Maps captures black or the capture dies mid-drive, there is no full-screen map; Option B (own OSM map, no route line) is not a fallback._
- _Map only: a square crop around the car, none of Google Maps' banners or buttons, full 480×480 circle._
- _The phone stays unlocked with Google Maps in front, and the capture consent is tapped once per Navigation Session. When the phone locks, capture stops (Android 15 QPR1+) and the watch falls back to the Turn Card. Mirroring while locked is researched separately in ticket 10 (Android Auto)._
- _The frame-rate bar for a full-screen frame is set after the runs. If 480 px frames are too slow, the fallback is 240 px frames shown at 480 on the watch._

**Blocked by:** 01 (Walking skeleton).

**Status:** in-progress

- [x] Prototype on a `prototype/mini-map` branch; main is untouched apart from the findings write-up.
- [x] The prototype measures image transfer from side service to watch: bytes per frame, frames per second, and end-to-end lag for a ~240-px circular map image, over three transports (PNG file, `image.convert` file, raw bytes).
- [x] The format conversion Zepp OS requires, measured on the desk: the watch's native image is a 58,688-byte uncompressed palette TGA for any 240×240 frame; a 216-colour palette PNG is ~12.7 KB.
- [ ] **Needs the user:** the bytes, fps and lag measured on the Redmi and the Active Max (runs in `docs/research/mini-map-findings.md`).
- [x] Option A built (MediaProjection, crop around the car, all-black frame count); Android 14/15 consent rules researched (consent every session, single-app choice, capture stops on screen lock from Android 15 QPR1).
- [ ] **Needs the user:** whether Google Maps captures (not black) on HyperOS 2 / Android 15 and what the consent dialog looks like.
- [x] Option B built: heading-up OSM map around the GPS position; tile licensing/caching terms noted (OSM usable for one device; Mapbox ruled out by its vehicle-use clause).
- [ ] **Needs the user:** Option B seen on the watch.
- [x] The lab gets a frame-size setting: 240 (the old Mini Map), 480 (Map Mirror, full circle), and 240 shown at 480 on the watch (upscaled). Option A's crop and the watch lab page follow the setting; the measurements report the size. _(A captures at full resolution for 480; the crop region itself is tuned by hand on the lab screen to keep Google Maps' banners out, see the findings.)_
- [x] Desk measurement: bytes per frame for a 480×480 frame as 216-colour palette PNG and as the watch's native TGA, added to the findings' cost table. _(Palette PNG 32–47 KB; native TGA 231,488 B always.)_
- [ ] **Needs the user:** Option A runs at 480 and at 240-shown-at-480 (fps, lag, bytes, sharpness on the wrist) added to the findings' run table.
- [ ] **Needs the user:** lock the phone during an Option A run: does capture stop on HyperOS 2, and does it come back after unlocking without new consent?
- [ ] **Needs the user (measurements):** Judged by the agreed bar: at least one update every 2 s, no more than ~2 s lag, readable at a glance on 480×480 in the bottom two-thirds circle. A wins if it meets it; otherwise B; if neither, no Mini Map. _(Superseded 2026-10-11: now judged for the Map Mirror, Option A only, against a bar set after the runs; see the note at the top.)_
- [ ] **Needs the user:** Battery drain on watch and phone noted for a ~15 min run.
- [ ] Findings write-up committed to the research docs with the recommendation, now about the Map Mirror: build it (at which frame size and rate), or no full-screen map. _(Committed with desk findings and a provisional recommendation; final once the runs are in.)_
