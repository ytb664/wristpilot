# 04: Turn arrows

**What to build:** The Turn Card shows the correct arrow for each Maneuver, matching what Google Maps shows: straight, slight left/right, left/right, sharp left/right, U-turn, keep left/right, merge, ramp left/right, roundabout (with exit number when the text has it), arrive. The Guidance core recognises the Maneuver kind from Google Maps' arrow icon (following starpath's approach, since Google Maps often sends icon-only instructions), falling back to the English text. Anything unrecognised shows a generic arrow plus the instruction text. Arrow images are bundled in the watch app; no images are sent at runtime.

**Blocked by:** 03 (Turn Card from the Guidance core).

**Status:** ready-for-agent

- [ ] Built test-first through the Guidance core seam: recorded snapshots with known turns produce the expected Maneuver kind in the Turn Card View, including icon-only instructions.
- [ ] Text fallback works when the icon is missing or unrecognised; unknown → generic arrow + instruction text.
- [ ] Watch app ships one arrow image per Maneuver kind, in the format Zepp OS requires, sized for the top of the 480×480 Turn Card.
- [ ] Every recorded fixture turn is classified; any misclassification found is added as a test case.
- [ ] Manual check (by the user): arrows on the watch match Google Maps during a real drive.
