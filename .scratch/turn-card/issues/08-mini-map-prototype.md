# 08: Mini Map prototype

**What to build:** A throwaway prototype that answers one question: how should the Mini Map be made? Option A mirrors Google Maps' screen (Android screen capture → crop/scale → send to the watch). Option B draws our own map around the driver (phone GPS position + OpenStreetMap/Mapbox tiles, heading-up, no route line). Measure both on the real phone and watch. Lives on a `prototype/mini-map` branch, not main; its findings go into a short write-up that the follow-up Mini Map spec will reference.

**Blocked by:** 01 (Walking skeleton).

**Status:** ready-for-agent

- [ ] Prototype on a `prototype/mini-map` branch; main is untouched apart from the findings write-up.
- [ ] Measures image transfer from side service to watch: bytes per frame, frames per second, and end-to-end lag for a ~240-px circular map image (and the format conversion Zepp OS requires).
- [ ] Option A: checks whether Google Maps allows screen capture on HyperOS 2 / Android 15 and what the capture consent flow looks like each session.
- [ ] Option B: shows a heading-up map around the current position with OSM or Mapbox tiles; notes tile licensing/caching terms.
- [ ] Judged by the agreed bar: at least one update every 2 s, no more than ~2 s lag, readable at a glance on 480×480 in the bottom two-thirds circle. A wins if it meets it; otherwise B; if neither, no Mini Map.
- [ ] Battery drain on watch and phone noted for a ~15 min run.
- [ ] Findings write-up committed to the research docs with the recommendation.
