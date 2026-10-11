# 08: Mini Map prototype

**What to build:** A throwaway prototype that answers one question: how should the Mini Map be made? Option A mirrors Google Maps' screen (Android screen capture → crop/scale → send to the watch). Option B draws our own map around the driver (phone GPS position + OpenStreetMap/Mapbox tiles, heading-up, no route line). Measure both on the real phone and watch. Lives on a `prototype/mini-map` branch, not main; its findings go into a short write-up that the follow-up Mini Map spec will reference.

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
- [ ] **Needs the user (measurements):** Judged by the agreed bar: at least one update every 2 s, no more than ~2 s lag, readable at a glance on 480×480 in the bottom two-thirds circle. A wins if it meets it; otherwise B; if neither, no Mini Map.
- [ ] **Needs the user:** Battery drain on watch and phone noted for a ~15 min run.
- [ ] Findings write-up committed to the research docs with the recommendation. _(Committed with desk findings and a provisional recommendation; final once the runs are in.)_
