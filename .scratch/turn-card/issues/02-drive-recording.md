# 02: Drive recording

**What to build:** The Android forwarder can record every Raw Guidance Snapshot of a drive to a file, including a small downscaled copy of Google Maps' Maneuver arrow (the notification's large icon), and export it from the phone. Recorded drives become the test fixtures for the Guidance core. The snapshot format is versioned so old recordings stay readable.

**Blocked by:** 01 (Walking skeleton).

**Status:** in-progress

- [x] Raw Guidance Snapshot gains the arrow icon as a small fixed-size bitmap (e.g. 48×48, compact grayscale/alpha encoding) and a format version field; it's also forwarded live over the WebSocket.
- [x] The forwarder's screen has a "Record drive" toggle; recordings are saved as one file per drive and can be shared/exported off the phone.
- [x] A small dev script in the repo loads a recording and prints a readable timeline (time, title, text, sub text, icon preview as ASCII).
- [ ] **Needs the user:** record real drives covering: normal multi-turn drive, icon-only instruction ("40 m" + street, no turn word), reroute, roundabout, highway ramp/merge, arrival, cancel, multi-stop route. The agent must stop and ask the user to do this.
- [ ] Recordings are trimmed if huge, any personal home/work addresses the user wants hidden are noted, and the fixtures are committed with a short index describing what each one covers.
