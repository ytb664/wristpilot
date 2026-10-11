# 04: Google Maps' arrow on the watch

**What to build:** The Turn Card shows Google Maps' own arrow image, so the watch always matches the phone, including roundabouts, ramps and anything unusual. The Android forwarder already sends the notification's large icon in each Raw Guidance Snapshot (ticket 02); this ticket sends it at a size that looks sharp at the top of the 480×480 Turn Card, passes it through the Guidance core into the Turn Card View, and draws it on the watch. No turn classification and no bundled arrow images (changed 2026-10-11 at the user's request).

**Blocked by:** 03 (Turn Card from the Guidance core).

**Status:** ready-for-agent

- [ ] The forwarder's arrow bitmap is big enough to look sharp at the top of the Turn Card (pick the size from the space the layout gives the arrow), bumping the snapshot format version; older recordings still load.
- [ ] Built test-first through the Guidance core seam: a snapshot with an arrow image puts it in the Turn Card View; the image is sent only when it changes (re-posts with the same arrow don't resend it); no arrow image → the instruction text shows instead.
- [ ] The watch draws the arrow from the received bitmap (e.g. on a canvas, or converted to an image file, whichever Zepp OS 4.2 on the Active Max handles smoothly), readable in sunlight and at night.
- [ ] Manual check (by the user): the arrow on the watch matches Google Maps during a real drive.
