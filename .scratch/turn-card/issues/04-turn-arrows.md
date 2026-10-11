# 04: Google Maps' arrow on the watch

**What to build:** The Turn Card shows Google Maps' own arrow image, so the watch always matches the phone, including roundabouts, ramps and anything unusual. The Android forwarder already sends the notification's large icon in each Raw Guidance Snapshot (ticket 02); this ticket sends it at a size that looks sharp at the top of the 480×480 Turn Card, passes it through the Guidance core into the Turn Card View, and draws it on the watch. No turn classification and no bundled arrow images (changed 2026-10-11 at the user's request).

**Blocked by:** 03 (Turn Card from the Guidance core).

**Status:** done

- [x] The forwarder's arrow bitmap is big enough to look sharp at the top of the Turn Card (pick the size from the space the layout gives the arrow), bumping the snapshot format version; older recordings still load.
- [x] Built test-first through the Guidance core seam: a snapshot with an arrow image puts it in the Turn Card View; the image is sent only when it changes (re-posts with the same arrow don't resend it); no arrow image → the instruction text shows instead.
- [x] The watch draws the arrow from the received bitmap (e.g. on a canvas, or converted to an image file, whichever Zepp OS 4.2 on the Active Max handles smoothly) (`zeus build` passes).
- [x] Manual check (by the user): the arrow looks sharp, draws without a visible delay, and is readable at night. _(checked in ticket 09: "the arrows is good", 2026-10-11, on the drives after the drawRect fix, 18:36 and 20:52, both after sunset)_
- [ ] Manual check (by the user): the arrow is readable in sunlight. _(no drive since the drawRect fix was in daylight; checked when one is)_
- [x] Manual check (by the user): the arrow on the watch matches Google Maps during a real drive. _(checked in ticket 09: "the direction works perfectly", 2026-10-11)_

## How the arrow gets to the watch (built 2026-10-11)

- **Forwarder:** format v4 sends the large icon at 120×120 (was 48×48), the arrow's box on the Turn Card, so the watch draws it 1:1 with no scaling. Older v2/v3 recordings carry `w`/`h` and still replay; `npm run timeline` shrinks a 120×120 arrow to 40 columns.
- **Guidance core:** the Turn Card View's `arrow` is the icon as-is, or `null` (then `instruction` is set and shows in the arrow's place). A view leaves `arrow` out when the watch already shows that image. `current()` returns the full view, arrow included, for a watch that opens mid-Navigation Session. The arrow is part of a Maneuver's identity (arrow + turn + street), so a new arrow on the same street doesn't keep the old distance.
- **Empty-title re-posts carry a stale arrow.** In the recording, Google Maps' empty-title re-posts between "100 m" and "90 m" carry the *previous* Maneuver's arrow. An empty-title post on the Turn Card's street, with no distance in its text, therefore keeps the Maneuver (arrow, distance) and only takes the new trip line. Ticket 09's fixtures should confirm this.
- **Side service:** turns the image into canvas rects (`app-side/arrow-rects.js`): runs of equal pixels in a row, grown down while rows repeat, with each pixel's gray premultiplied by its alpha over the black Turn Card, so no canvas alpha is needed. The gray is rounded to four levels (black, 5, 10, 15), which halves the rect count. The recording's 48×48 arrows, upscaled to 120×120 (blurrier than a real 120×120 render, so this is a worst case), come out at 250–540 rects (3–7 KB).
- **Watch:** a 120×120 CANVAS at the top, redrawn only when a new arrow arrives; `drawRect` fills each rect. If a view without an arrow reaches a newly opened page before its `turnCard.current` reply, the page asks again. Unverified until ticket 09: how fast a few hundred `drawRect` calls draw on the Active Max. If it's slow: coarser grays, or an image file instead of a canvas. Also unverified: whether Google Maps' icon is at least 120 px to begin with; if it's smaller, scaling it up blurs it.
