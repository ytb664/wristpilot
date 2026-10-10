# 01: Walking skeleton — Google Maps text on the watch

**What to build:** The first end-to-end path. When I start directions in Google Maps on the Navigation Phone, the raw instruction text from Google Maps' navigation notification appears on the watch in Wristpilot, and updates as Google Maps updates it. This proves the whole chain works on the Redmi 13C (HyperOS 2, Android 15) and the Amazfit Active Max before anything is built on it. It also lays out the repo: the Android forwarder project, the Zepp OS project (watch app + side service), and a JavaScript test runner for the Guidance core.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Repo contains an Android (Kotlin) project for the forwarder and a Zepp OS project (device app + side service) targeting the Active Max (deviceSource 10813697, 10813699, API level 4.2, round 480×480).
- [x] A Guidance core module exists in the side service as a pure function boundary (snapshots + time in → Turn Card View + Buzz commands out), with a test runner wired up and one passing placeholder test through that boundary.
- [x] The Android forwarder asks for notification access, listens only to Google Maps (`com.google.android.apps.maps`) navigation notifications, and forwards each post/removal as a Raw Guidance Snapshot (text extras, ongoing flag, category, timestamp, key) over a local WebSocket server on the phone. _(The forwarder filters by package only; deciding which Maps notifications are guidance happens in the Guidance core, to keep navigation logic out of the forwarder.)_
- [x] The side service connects to that local WebSocket, passes snapshots through the Guidance core (which for now just echoes the title text), and sends the result to the watch.
- [x] The watch app shows the received text on a simple screen and the Waiting Screen text when nothing has arrived.
- [x] README explains how to build and sideload both parts (Zepp Developer Mode / `zeus preview`, debug APK) and how to allow restricted settings + grant notification access on Android 15.
- [x] Manual check (by the user): start directions in Google Maps → instruction text appears on the watch and changes as you move. _(Passed 2026-10-11 on the Redmi 13C + Active Max.)_

## Findings from the manual check

- On the Navigation Phone, Google Maps puts the **distance in the notification title** (e.g. "0 m" at the start) and the **turn and street in the text**. Ticket 03's parsing should start from that layout.
- The watch page needs the `data:os.device.info` permission (ZML and `getDeviceInfo()` use it); without it the page is a black screen.
- A file-manager install hits Play Protect and Android 15's restricted settings; installing over adb, or granting access with `adb shell cmd notification allow_listener dev.wristpilot.forwarder/dev.wristpilot.forwarder.MapsNotificationListener`, gets around both.
