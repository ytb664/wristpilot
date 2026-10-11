# 06: Screen stays on, Stale Turn Card

**What to build:** For the whole Navigation Session the watch screen stays on and Wristpilot stays open, even if the wrist drops or the screen is touched; normal screen behaviour returns when the session ends. If the watch hears nothing from the Navigation Phone for about 5 seconds, it shows a Stale Turn Card (greyed out, "disconnected" mark) and returns to normal automatically on the next message.

**Blocked by:** 03 (Turn Card from the Guidance core).

**Status:** in-progress

- [x] While Google Maps is giving directions (a Turn Card on the watch), the page asks for the longest bright time Zepp OS allows (`setPageBrightTime`, about 24 days), and the swipe-right back gesture is blocked so a stray touch can't close Wristpilot (the button still leaves).
- [ ] The watch never sleeps or falls back to the watch face on its own: Wristpilot stays on screen for the whole Navigation Session, however long (the user saw it return to the watch face after a while, 2026-10-11). _(checked in ticket 09)_
- [x] During a session the page stays bright, wrist-drop and palm-cover screen-off are paused and relaunch-on-wake is set; all restored when the session ends (Waiting Screen / Arrived). `zeus build` passes.
- [x] The side service sends a `turnCard.heartbeat` when it has sent the watch nothing for 2 s during a Navigation Session, and only while the Android forwarder is connected (without it no guidance can arrive, so the watch should go stale).
- [x] Stale timeout logic on the watch is tested (messages in + elapsed time → stale or not); timeout is a single tunable constant (`STALE_AFTER_MS` in `zepp/page/stale-timer.js`, 5 s).
- [x] The Stale Turn Card dims the text and Google Maps' arrow and shows a red "Disconnected" mark; any message (view, buzz, heartbeat) clears it and asks the side service for `turnCard.current`, so an arrow lost during the silence is redrawn.
- [ ] The Stale Turn Card looks clearly greyed out with a readable "Disconnected" mark on the watch. _(checked in ticket 09)_
- [ ] Manual check (by the user): screen stays on and Wristpilot stays open through a whole drive; turning Bluetooth off on the phone shows the Stale Turn Card, turning it on recovers. _(checked in ticket 09)_

## How it was built (2026-10-11)

- The Stale Turn Card only replaces a Turn Card: the Waiting Screen and "Arrived" are never shown stale.
- The watch only starts its stale clock at the first message: opened with no contact, it shows the Waiting Screen.
- Relaunch-on-wake is not reset when the page is destroyed: the system closing Wristpilot while the screen is off destroys the page too, and waking the watch must still reopen it. It is reset when the session ends.
- Unverified: whether the side service's WebSocket fires `onopen`; a snapshot also marks the forwarder as connected, so heartbeats start with the first snapshot either way.

## Noted in ticket 04's code review

- _(Done: see the Stale Turn Card criterion above.)_ Views leave out Google Maps' arrow when the watch already has it (ticket 04). If a message carrying a new arrow is lost, the watch keeps the old arrow until the next arrow change. When the watch comes back from stale, it should ask the side service for `turnCard.current` (the full view, arrow included) rather than wait for the next view.
