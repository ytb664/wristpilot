# 07: Opening Wristpilot and surviving HyperOS

**What to build:** Wristpilot is easy to open and keeps working for a whole drive on the Redmi 13C. When Google Maps navigation starts, the Android forwarder (already running in the background) posts a "Navigation started" notification that Zepp mirrors to the watch; tapping it opens Wristpilot if Zepp OS allows it, otherwise it's a reminder. A watch button shortcut is the backup. The forwarder starts forwarding by itself without being opened, survives with the phone screen off, and its one screen shows whether notification access is granted, whether the watch link is up, and the HyperOS setup checklist.

**Blocked by:** 01 (Walking skeleton).

**Status:** ready-for-agent

- [ ] Forwarder runs a foreground service while a Navigation Session is active and posts the "Navigation started" notification at session start.
- [ ] README says what to expect from tapping that notification on the watch (opens Wristpilot, or reminder-only), as far as the Zepp OS docs tell.
- [ ] Manual check (by the user): tapping "Navigation started" on the watch opens Wristpilot or not; the README is corrected to match. _(checked in ticket 09)_
- [ ] README documents setting a watch button shortcut to Wristpilot on the Active Max.
- [ ] Forwarder status screen shows: notification access granted?, WebSocket client (side service) connected?, last snapshot time, and the HyperOS checklist (allow restricted settings, notification access, autostart on, battery saver "No restrictions" for Wristpilot and Zepp, lock both in Recents) with buttons that open each relevant settings page where possible.
- [ ] The forwarder is never frozen during a Navigation Session. On 2026-10-11 HyperOS froze it for 12 minutes of a Navigation Session: Google Maps' updates were held back and delivered all at once at arrival, so the watch stayed on the first Maneuver (see ticket 02, "Solved"). In a v3 recording, snapshots "delivered N s late" in `npm run timeline` show it happening.
- [ ] Side service reconnects to the forwarder's WebSocket automatically after a drop.
- [ ] Manual check (by the user): one full real drive (20+ min) with the phone screen off and Google Maps navigating; guidance keeps arriving on the watch the whole time. Any failure is diagnosed and noted. _(checked in ticket 09)_
