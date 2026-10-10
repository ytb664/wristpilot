# 01: Walking skeleton — Google Maps text on the watch

**What to build:** The first end-to-end path. When I start directions in Google Maps on the Navigation Phone, the raw instruction text from Google Maps' navigation notification appears on the watch in Wristpilot, and updates as Google Maps updates it. This proves the whole chain works on the Redmi 13C (HyperOS 2, Android 15) and the Amazfit Active Max before anything is built on it. It also lays out the repo: the Android forwarder project, the Zepp OS project (watch app + side service), and a JavaScript test runner for the Guidance core.

**Blocked by:** None (can start immediately).

**Status:** in-progress

- [ ] Repo contains an Android (Kotlin) project for the forwarder and a Zepp OS project (device app + side service) targeting the Active Max (deviceSource 10813697, 10813699, API level 4.2, round 480×480).
- [ ] A Guidance core module exists in the side service as a pure function boundary (snapshots + time in → Turn Card View + Buzz commands out), with a test runner wired up and one passing placeholder test through that boundary.
- [ ] The Android forwarder asks for notification access, listens only to Google Maps (`com.google.android.apps.maps`) navigation notifications, and forwards each post/removal as a Raw Guidance Snapshot (text extras, ongoing flag, category, timestamp, key) over a local WebSocket server on the phone.
- [ ] The side service connects to that local WebSocket, passes snapshots through the Guidance core (which for now just echoes the title text), and sends the result to the watch.
- [ ] The watch app shows the received text on a simple screen and the Waiting Screen text when nothing has arrived.
- [ ] README explains how to build and sideload both parts (Zepp Developer Mode / `zeus preview`, debug APK) and how to allow restricted settings + grant notification access on Android 15.
- [ ] Manual check (by the user): start directions in Google Maps → instruction text appears on the watch and changes as you move.
