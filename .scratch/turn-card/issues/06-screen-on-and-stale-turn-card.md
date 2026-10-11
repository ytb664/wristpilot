# 06: Screen stays on, Stale Turn Card

**What to build:** For the whole Navigation Session the watch screen stays on and Wristpilot stays open, even if the wrist drops or the screen is touched; normal screen behaviour returns when the session ends. If the watch hears nothing from the Navigation Phone for about 5 seconds, it shows a Stale Turn Card (greyed out, "disconnected" mark) and returns to normal automatically on the next message.

**Blocked by:** 03 (Turn Card from the Guidance core).

**Status:** ready-for-agent

- [ ] While Google Maps is giving directions the watch never sleeps or falls back to the watch face on its own: Wristpilot stays on screen for the whole Navigation Session, however long (the user saw it return to the watch face after a while, 2026-10-11).
- [ ] During a session the page stays bright, wrist-drop screen-off is paused and relaunch-on-wake is set; all restored when the session ends (Waiting Screen / Arrived).
- [ ] The side service sends a lightweight heartbeat often enough that a quiet stretch on a long straight road doesn't trigger staleness.
- [ ] Stale timeout logic on the watch is tested (messages in + elapsed time → stale or not); timeout is a single tunable constant (start at 5 s).
- [ ] Stale Turn Card renders greyed out with a clear "disconnected" mark; the next message restores the normal Turn Card.
- [ ] Manual check (by the user): screen stays on and Wristpilot stays open through a whole drive; turning Bluetooth off on the phone shows the Stale Turn Card, turning it on recovers.

## Noted in ticket 04's code review

- Views leave out Google Maps' arrow when the watch already has it (ticket 04). If a message carrying a new arrow is lost, the watch keeps the old arrow until the next arrow change. When the watch comes back from stale, it should ask the side service for `turnCard.current` (the full view, arrow included) rather than wait for the next view.
