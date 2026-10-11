# 02: Drive recording

**What to build:** The Android forwarder can record every Raw Guidance Snapshot of a drive to a file, including a small downscaled copy of Google Maps' Maneuver arrow (the notification's large icon), and export it from the phone. Recorded drives become the test fixtures for the Guidance core. The snapshot format is versioned so old recordings stay readable.

**Blocked by:** 01 (Walking skeleton).

**Status:** in-progress

- [x] Raw Guidance Snapshot gains the arrow icon as a small fixed-size bitmap (e.g. 48×48, compact grayscale/alpha encoding) and a format version field; it's also forwarded live over the WebSocket.
- [x] The forwarder's screen has a "Record drive" toggle; recordings are saved as one file per drive and can be shared/exported off the phone.
- [x] A small dev script in the repo loads a recording and prints a readable timeline (time, title, text, sub text, icon preview as ASCII).
- [x] _Moved to ticket 09 (the user chose to build all tickets first and test with real drives at the end, 2026-10-11):_ recording real drives and committing them as fixtures.

## Open: the watch froze at the first Maneuver (2026-10-11)

During a real drive the watch stayed on "0 m" and the first street (Jl. Alpha) and never updated. Ticket 01's check had passed, and the cause isn't known yet. Since then the phone screen shows "Last Google Maps update: N s ago (M so far)" and forwarding can't crash the listener.

To find where updates stop, the next session needs one of:
- the Drive Recording from that drive, or one from a new short drive with **Record drive** on. Many lines with changing distances mean the phone got every update and the problem is between the phone and the watch (Zepp side service, or the watch app going to sleep, ticket 06). One or two lines mean the forwarder stopped (crash, or HyperOS freezing it, ticket 07);
- or, with the phone on USB after the drive: `adb logcat -d -s WristpilotListener WristpilotServer WristpilotRecorder AndroidRuntime`, plus `adb logcat -d -b crash`.

Set the status to `done` once the cause is known and either fixed here or handed to the ticket it belongs to (06 or 07).
