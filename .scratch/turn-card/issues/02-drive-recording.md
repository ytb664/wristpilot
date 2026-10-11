# 02: Drive recording

**What to build:** The Android forwarder can record every Raw Guidance Snapshot of a drive to a file, including a small downscaled copy of Google Maps' Maneuver arrow (the notification's large icon), and export it from the phone. Recorded drives become the test fixtures for the Guidance core. The snapshot format is versioned so old recordings stay readable.

**Blocked by:** 01 (Walking skeleton).

**Status:** done

- [x] Raw Guidance Snapshot gains the arrow icon as a small fixed-size bitmap (e.g. 48×48, compact grayscale/alpha encoding) and a format version field; it's also forwarded live over the WebSocket.
- [x] The forwarder's screen has a "Record drive" toggle; recordings are saved as one file per drive and can be shared/exported off the phone.
- [x] A small dev script in the repo loads a recording and prints a readable timeline (time, title, text, sub text, icon preview as ASCII).
- [x] _Moved to ticket 09 (the user chose to build all tickets first and test with real drives at the end, 2026-10-11):_ recording real drives and committing them as fixtures.

## Solved: the watch froze at the first Maneuver (2026-10-11)

During a real drive the watch stayed on "0 m" and the first street (Jl. Alpha) and never updated.

**Cause: HyperOS froze the Android forwarder in the background.** The user's recording `drive-20261011-135820.jsonl` (kept out of git; it holds real streets, see ticket 09) holds two Navigation Sessions:
- 13:58: "Starting navigation…", then "0 m · Jl. Alpha" for 75 s, then removed (cancelled before moving off); nothing to learn about the freeze from it.
- 15:50: "Starting navigation…" and "0 m · Jl. Alpha", then **nothing reached the forwarder from 15:51:17 to 16:03:14 (12 minutes)**. At 16:03:14 **251 snapshots arrived within 2 seconds**. Their sub texts run from "3:56 PM ETA" to "4:04 PM ETA" and their distances count down 110 m → 0 m and move on to Jl. Charlie. Google Maps was posting all along, but Android held the forwarder's notification callbacks while its process was frozen and delivered them all at once when it thawed (probably when the user opened the forwarder on arrival; not confirmed).

So the phone never forwarded anything after the first Maneuver; the side service and the watch did nothing wrong. Keeping the forwarder from being frozen is **ticket 07** (foreground service during a Navigation Session, HyperOS battery settings); its acceptance criteria now name this.

Fixed here: the recording stamped each snapshot with when the forwarder *got* it (`at`), so this session's real timing is lost. Format **v3** adds `postedAt`, Google Maps' own post time (`StatusBarNotification.postTime`; null for removals, which have none), and the timeline script times v3 recordings by it, flags snapshots "delivered N s late", and marks removals "timed by delivery". A frozen forwarder now shows up at a glance in any recording. Still to confirm on the first v3 recording: that `postTime` moves with each Google Maps update rather than staying at the session's first post (if every update looks "late", it doesn't).

Google Maps quirks seen in this recording are noted in ticket 03.
