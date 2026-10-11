# 10: Map Mirror while the phone is locked (research)

**What to build:** A research write-up that answers one question: can the Map Mirror keep running while the Navigation Phone is locked? Screen capture can't (Android 15 QPR1+ ends it on lock, and a locked phone shows no Google Maps screen). The one candidate found is Android Auto: Google Maps keeps streaming its map, route line included, to a car's screen while the phone is locked. Open-source apps (Headunit Revived, Open Headunit "self mode") make a phone act as its own Android Auto screen, so Wristpilot could take that video, crop it and send it to the watch. Research only, no build; the result goes in `docs/research/`.

**Blocked by:** 08 (only worth doing if the Map Mirror works with the phone unlocked).

_Changed 2026-10-11: ticket 08's device runs now happen in ticket 09, after this one, so whether the Map Mirror works unlocked isn't known yet. Do the research anyway and make the recommendation conditional on those runs._

**Status:** ready-for-agent

- [ ] Whether Google Maps keeps streaming to a phone-hosted Android Auto screen while the phone is locked (primary sources, issue trackers, the headunit projects).
- [ ] What it would take: the Android Auto protocol pieces, H.264 decoding on the phone, licensing of the headunit code, and whether Android Auto 17.4+ still allows self mode on the Redmi 13C (HyperOS 2, Android 15).
- [ ] How fragile it is: how often Google has broken self mode, and whether Wristpilot's Turn Card guidance would be affected when Android Auto runs.
- [ ] Recommendation: worth a prototype ticket, or the Map Mirror stays unlocked-only. If it's worth one, note it would reach Google Maps by a different route than ADR 0001 describes (still mirroring Google Maps, no routing of our own) and ask the user before writing an ADR.
