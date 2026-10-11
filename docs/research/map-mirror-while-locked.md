# Map Mirror while the Navigation Phone is locked (ticket 10)

**Date:** 2026-10-11
**Question:** Can the Map Mirror keep running while the Navigation Phone is locked? Screen capture can't: Android 15 QPR1+ ends it on lock (see `mini-map-findings.md`). The one candidate is Android Auto. Google Maps keeps drawing its map, route line included, for a car's screen while the phone is locked. Open-source "head unit" apps make a phone act as its own Android Auto screen ("self mode"). Wristpilot could take that H.264 video, crop it and send it to the watch.

**Short answer:** Possibly, but nobody has shown it, and the approach is fragile.

- Android Auto itself runs with the phone locked: Xiaomi documents a "Start Android Auto while locked" switch.
- Starting it needs an unlocked phone (Google's DHU guide).
- I found **no** report of self mode surviving a phone lock. The one maintained open-source receiver (Open Headunit) stops its own decoder when the screen goes off, and gives up video focus when its window is covered. I found no one who has tested it.
- Since Android Auto 17.4 (July 2026), self mode works only through a hidden developer switch, "Start head unit server", turned on by hand in Android Auto's developer settings.
- Google broke self mode once for certain in 2026 (17.4, July), and earlier in 16.4 for Android 10 and below. One unconfirmed report says 17.8 (September) broke it again.
- Running Android Auto probably doesn't remove Google Maps' navigation notification, so the Turn Card keeps its input. Only secondary and anecdotal evidence supports this.

**Recommendation:** no prototype ticket yet. If ticket 09 shows the screen-captured Map Mirror is worth having with the phone unlocked, run one cheap check with the user first (§4). Write a prototype ticket only if that check passes. It would also need an ADR, with the user's say-so.

Conventions: every claim links to its source. **[UNVERIFIED]** marks a claim I could not trace to a primary source. **[INFERENCE]** marks my own reasoning from cited facts. Open Headunit source links point at commit `4ee1d58` (2026-10-10).

---

## 1. Does Google Maps keep streaming to a phone-hosted Android Auto screen while the phone is locked?

### 1.1 What is known

| Claim | Source |
|---|---|
| Android Auto can run in a car while the phone stays locked. On Xiaomi phones: Settings → More connectivity options → Android Auto → **Start Android Auto while locked**. "allows you to use the phone on your car's infotainment system without needing to unlock your phone." | [Xiaomi FAQ KA-539294](https://www.mi.com/global/support/faq/details/KA-539294/) |
| Starting a session against a head unit server needs the phone unlocked: "Make sure the mobile device's screen is unlocked so it can launch the DHU." The first connection also needs terms and permissions accepted on the phone. | [Google: Test with the Desktop Head Unit](https://developer.android.com/training/cars/testing/dhu) (updated 2026-07-13) |
| The head unit server listens on port 5277 and runs as a foreground service on the phone. | same |
| Self mode is a wireless Android Auto connection to the same device: "Android Auto thinks it is connected to a headunit." | [Open Headunit #732, maintainer](https://github.com/andreknieriem/open-headunit/issues/732) |
| Android Auto ends a self-mode session "whenever the phone's USB port changes state, whatever you plug in or unplug." | [Open Headunit wiki: Capturing Logs](https://github.com/andreknieriem/open-headunit/wiki/Capturing-Logs) |
| Open Headunit **stops its video decoder on `SCREEN_OFF`** (`pauseForSleep` → `videoDecoder.stop(REASON_SCREEN_OFF_SLEEP)`). | [AapService.kt L654–659](https://github.com/andreknieriem/open-headunit/blob/4ee1d58f6cf7f39f7dc0a6ef93509553401ec6aa/app/src/main/java/com/andrerinas/openheadunit/aap/AapService.kt#L654-L659), [AapTransport.kt L750–755](https://github.com/andreknieriem/open-headunit/blob/4ee1d58f6cf7f39f7dc0a6ef93509553401ec6aa/app/src/main/java/com/andrerinas/openheadunit/aap/AapTransport.kt#L750-L755) |
| When another window covers its picture, Open Headunit tells the phone it has given up video focus (`VIDEO_FOCUS_NATIVE`), and "Android Auto reads that as the projection being over". | [VideoFocusReleasePolicy.kt](https://github.com/andreknieriem/open-headunit/blob/4ee1d58f6cf7f39f7dc0a6ef93509553401ec6aa/app/src/main/java/com/andrerinas/openheadunit/aap/VideoFocusReleasePolicy.kt) |
| A user with "Start Android Auto while locked" turned on couldn't get a USB session to start while their phone was locked. They worked around it by unlocking automatically. | [Open Headunit #848](https://github.com/andreknieriem/open-headunit/issues/848) |

### 1.2 What is not known

- **[UNVERIFIED]** I found no issue, README, wiki page or XDA post saying whether Android Auto keeps sending video over a self-mode (loopback) connection after the phone locks. I searched Open Headunit issues for "lock", "locked", "screen off" and "self mode", and also the Headunit Reloaded XDA thread. **[INFERENCE]** It has probably never been tried, because the receivers stop on screen-off by design (above).
- **[INFERENCE]** It probably does keep sending. Android Auto renders the car screen on the phone while the phone is locked in a real car (Xiaomi FAQ), and a self-mode session looks like a wireless car to it. The Android 15 rule that ends screen capture on lock applies to third-party MediaProjection. Android Auto doesn't use that: it holds a system role, `SYSTEM_AUTOMOTIVE_PROJECTION`, according to an Open Headunit contributor ([#994](https://github.com/andreknieriem/open-headunit/issues/994)). A Wristpilot receiver would decode into an off-screen surface and would never give up video focus, so neither Open Headunit behaviour above applies.
- **Does self mode need the screen on?** **[INFERENCE]** Only to start (unlock, tap the server switch, tap connect). Nothing I found says it needs the screen on after that. Open Headunit's screen-off pause is its own choice, made for head units that sleep.

**Bottom line:** a likely yes, not shown. A 15-minute check answers it (§4).

---

## 2. What it would take

### 2.1 Android Auto protocol pieces (head-unit side)

| Piece | What it involves | Source |
|---|---|---|
| Transport | USB (Android Open Accessory), wireless (Bluetooth RFCOMM handshake, then Wi-Fi), or TCP to the phone's own head unit server on port 5277. On Android Auto 17.4+, self mode is **only** the last: loopback TCP to 5277. | [Open Headunit README](https://github.com/andreknieriem/open-headunit/blob/main/README.md), [wiki: Wireless](https://github.com/andreknieriem/open-headunit/wiki/Wireless) |
| Version exchange, then TLS | The head unit is the TLS **client** (`useClientMode = true`). It presents a certificate signed by Google's "Google Automotive Link" CA. Open Headunit ships one (subject `O=Google-Android-Reference`, valid 2014-07-08 to **2044-07-07**: I read the dates from `res/raw/cert` with `openssl`). | [AapSslContext.kt L165–166](https://github.com/andreknieriem/open-headunit/blob/4ee1d58f6cf7f39f7dc0a6ef93509553401ec6aa/app/src/main/java/com/andrerinas/openheadunit/aap/AapSslContext.kt#L165-L166), [res/raw/cert](https://github.com/andreknieriem/open-headunit/blob/4ee1d58f6cf7f39f7dc0a6ef93509553401ec6aa/app/src/main/res/raw/cert) |
| Service discovery | The head unit lists its channels: video sink (resolution 800×480 / 1280×720 / 1920×1080, plus portrait variants; margins; density; codec), input, sensors, audio, navigation status, and others. | [control.proto L80–116](https://github.com/andreknieriem/open-headunit/blob/4ee1d58f6cf7f39f7dc0a6ef93509553401ec6aa/app/src/main/proto/control.proto#L80-L116), [DHU guide: three resolutions](https://developer.android.com/training/cars/testing/dhu) |
| Video channel | Setup, video focus, then encoded frames that the head unit acknowledges. Codecs in the protocol: H.264 BP, VP9, AV1, H.265. | [media.proto L24–32](https://github.com/andreknieriem/open-headunit/blob/4ee1d58f6cf7f39f7dc0a6ef93509553401ec6aa/app/src/main/proto/media.proto#L24-L32) |
| Input channel | Must be declared. Android Auto ends a session with "No input for display 1" when a display has none. | [Open Headunit PR #1097](https://github.com/andreknieriem/open-headunit/pull/1097) (draft) |
| Sensors | Night mode (`NIGHT`, `is_night_mode`) and driving status. The DHU's `night` command switches the map to its "low-brightness, high-contrast" style. **[INFERENCE]** Wristpilot could always report night, to get a dark map for the watch. | [sensors.proto](https://github.com/andreknieriem/open-headunit/blob/4ee1d58f6cf7f39f7dc0a6ef93509553401ec6aa/app/src/main/proto/sensors.proto), [DHU guide](https://developer.android.com/training/cars/testing/dhu) |
| Audio | Optional. Open Headunit's "Audio Sink" switch: "Off leaves the sound on the phone." Google Maps' voice would then stay on the phone speaker. | [wiki: Settings](https://github.com/andreknieriem/open-headunit/wiki/Settings) |

Two extras worth knowing:

- Android Auto has a second "auxiliary/cluster" video channel. Google's DHU guide: "Some vehicles have cluster displays capable of displaying rich visual information such as map tiles" ([DHU guide, Cluster Display](https://developer.android.com/training/cars/testing/dhu)). An open Open Headunit PR decodes that channel, and can stream raw H.264 over TCP ([#1097](https://github.com/andreknieriem/open-headunit/pull/1097)). **[UNVERIFIED]** Whether Google Maps draws a map without banners there for a non-certified head unit. If it did, the crop would get easier.
- Android Auto also sends turn-by-turn data on a navigation status channel, which Open Headunit turns into notifications ([#560](https://github.com/andreknieriem/open-headunit/issues/560), [#1061](https://github.com/andreknieriem/open-headunit/issues/1061)). It's out of scope here, but it is a second source of Maneuvers.

**[INFERENCE]** The size of the work: building the receiver from scratch is a large job (TLS framing, protobuf channels, flow control, keyframe recovery). Open Headunit's changelog shows a year of fixes to exactly these parts. The realistic routes are a fork of Open Headunit, or taking its `aap/` package.

### 2.2 H.264 decoding on the phone

- **[INFERENCE]** Decode with `MediaCodec` into an `ImageReader` surface (no window). Then crop to the map, scale to 240 or 480 px, and encode a palette PNG (the existing Map Mirror path). At 800×480 the Redmi's hardware decoder has an easy job. I found no Android rule against decoding with the screen off. It needs a foreground service and a partial wake lock.
- The foreground service type that fits is `connectedDevice`. It needs `FOREGROUND_SERVICE_CONNECTED_DEVICE` plus, for example, `CHANGE_NETWORK_STATE` ([Google: FGS types](https://developer.android.com/develop/background-work/services/fgs/service-types), updated 2026-10-01). The forwarder currently uses `specialUse`.
- Open Headunit's notes say H.265 decoders on some devices are broken: "set it to h264" ([README, Known Issues](https://github.com/andreknieriem/open-headunit/blob/main/README.md)). Wristpilot should offer H.264 only.

### 2.3 Licensing

| Project | Licence | Note |
|---|---|---|
| [Open Headunit](https://github.com/andreknieriem/open-headunit) (formerly Headunit Revived; active, Oct 2026) | **AGPL-3.0** ([LICENSE](https://github.com/andreknieriem/open-headunit/blob/main/LICENSE)) | Based on Michael Reid's code. His notice: "licensed under GPLv3 Affero, but I am considering re-licensing under BSD or Apache" ([COPYRIGHT_MICHAEL_REID_GPLv3AFFERO.txt](https://github.com/andreknieriem/open-headunit/blob/main/COPYRIGHT_MICHAEL_REID_GPLv3AFFERO.txt)). No re-licence happened. |
| [mikereidis/headunit](https://github.com/mikereidis/headunit) (last push 2018) | **AGPL-3.0** | The original. |
| [anod/headunit](https://github.com/anod/headunit) (2019), [gartnera/headunit](https://github.com/gartnera/headunit) (Linux port) | **AGPL-3.0** | Forks of Reid's. |
| [f1xpl/aasdk](https://github.com/f1xpl/aasdk), [f1xpl/openauto](https://github.com/f1xpl/openauto) | **GPL-3.0** (stated in the Readme and file headers; no LICENSE file) | C++, Linux; no Android receiver. |
| [opencardev/aasdk](https://github.com/opencardev/aasdk), [openauto](https://github.com/opencardev/openauto), [crankshaft](https://github.com/opencardev/crankshaft) | **GPL-3.0** | Raspberry Pi head units. |
| [nisargjhaveri/WirelessAndroidAutoDongle](https://github.com/nisargjhaveri/WirelessAndroidAutoDongle) | MIT | A wired-to-wireless proxy, not a head unit: no use here. |

**[INFERENCE]** Personal, sideloaded use: the GPL and AGPL put their duties on *conveying* the program, and the AGPL also on offering a modified version over a network. Wristpilot does neither, so nothing is owed. If Wristpilot's forwarder takes Open Headunit code and is ever shared, the whole forwarder must be shared under the AGPL-3.0. Separately, every one of these projects talks to Android Auto with a Google reference certificate that Google never licensed for this use. That is a Google terms question, not a copyright one. I found no Google statement about it.

### 2.4 Does current Android Auto still allow self mode, on the Redmi 13C?

- **Current version:** 17.8 reached stable around 2026-09-29, and 17.9 is rolling out (build 17.9.6640 seen 2026-10-04). **[UNVERIFIED]** That comes from press reports ([autoevolution](https://www.autoevolution.com/news/new-android-auto-update-now-available-in-the-google-play-store-here-s-how-to-skip-the-wait-276505.html)). Google publishes no Android Auto changelog that I could find.
- **17.4+:** Google made `WirelessStartupActivity` non-exported and disabled `WirelessStartupReceiver`. Android Auto now checks for a live Bluetooth connection to the head unit. Classic self mode is dead. "Self-Mode (1 Device - Phone/Tablet): Cannot be Bluetooth-connected to itself. Solution: Enable 'Start Headunit Server' in AA Developer Settings (127.0.0.1:5277)" ([#698, maintainer, 2026-07-28](https://github.com/andreknieriem/open-headunit/issues/698); [wiki: Wireless](https://github.com/andreknieriem/open-headunit/wiki/Wireless): "The **only remaining solution**"). Open Headunit's beta3 detects Android Auto 17.4+ and points its self-mode button at the head unit server; two users still couldn't connect with it, one even after rebooting ([#698, 2026-07-30](https://github.com/andreknieriem/open-headunit/issues/698)). Rooted phones can re-enable the receiver ([README](https://github.com/andreknieriem/open-headunit/blob/main/README.md)). The Redmi isn't rooted.
- **Developer mode:** Android Auto settings → tap "Version and permission info" 10 times → overflow menu → **Start head unit server** ([Google: Test Android apps for cars](https://developer.android.com/training/cars/testing), updated 2026-10-06). The other developer toggle, "Allow unknown sources", is for media, messaging and parked *apps* installed outside Play. Self mode doesn't need it (same page).
- **Working reports:** self mode on 17.5 worked for a contributor (Android 15) ([#897](https://github.com/andreknieriem/open-headunit/issues/897)). The maintainer found 17.8 beta "works as before" ([#985](https://github.com/andreknieriem/open-headunit/issues/985)).
- **Redmi 13C / HyperOS 2:** **[UNVERIFIED]** I found no report either way. The one HyperOS issue is a *Chinese* ROM without Google's automotive role ([#994](https://github.com/andreknieriem/open-headunit/issues/994)). **[INFERENCE]** The global HyperOS ROM ships Android Auto as a system setting (the Xiaomi FAQ menu path above), so that failure shouldn't apply. The USB-lock blocks reported on Android 15 (Advanced Protection on Android Auto 17.2, §3.1; and Samsung phones **[UNVERIFIED]**, source not kept) concern USB starts, and self mode uses loopback TCP, so they shouldn't apply either. I haven't checked either point on the device.
- **Offline:** the GitHub build of Open Headunit starts a dummy VPN, because Android Auto checks for a network during first-run setup. The Play build can't ([#897](https://github.com/andreknieriem/open-headunit/issues/897)). **[INFERENCE]** The Navigation Phone has mobile data during a Navigation Session (Google Maps needs it for live traffic), so this is unlikely to matter.

---

## 3. How fragile it is

### 3.1 Google breaking third-party head units and self mode

| When | What broke | Source |
|---|---|---|
| Android Auto 16.4 (date not found) | Self-mode start disabled on Android 10 and below. | [wiki: Troubleshooting](https://github.com/andreknieriem/open-headunit/wiki/Troubleshooting) |
| Android Auto 17.2 (2026) | Auto-connect over USB disabled while locked under Advanced Protection. | [autoevolution](https://www.autoevolution.com/news/google-releases-android-auto-172-with-a-big-change-for-users-running-it-with-a-cable-272392.html) **[UNVERIFIED]** (press) |
| Android Auto 17.4 (late July 2026) | Wireless startup triggers closed. Self mode works only via the developer head unit server. "we depend on Google making that available again." | [#698](https://github.com/andreknieriem/open-headunit/issues/698) (opened 2026-07-26) |
| Android Auto 17.8 (Sept 2026) | One user: self mode disconnects after 1–2 s and works again on 17.7. The maintainer couldn't reproduce it. | [#985](https://github.com/andreknieriem/open-headunit/issues/985) |
| Certificate | I found no revocation of the reference certificate, and it is valid to 2044. **[UNVERIFIED]** Absence of evidence only. Google could stop accepting it in any update. | §2.1 |

**[INFERENCE]** Google closed a self-mode path once for certain in 2026, and what remains is a hidden developer switch. Expect another break within a year. Each break would silently kill the locked Map Mirror until someone finds a workaround (downgrading Android Auto, as users did in #698 and #985). The Turn Card doesn't depend on any of this, so it would keep working.

### 3.2 Does running Android Auto change what the Turn Card reads?

- **Probably not.** The Garminuino author parses Google Maps' notification for a HUD. In 2020 he wrote "The app can works with android auto" with a photo, and repeated it in 2026: "Yes, it would work. I have a demo about this." ([Garminuino #22](https://github.com/skyforcetw/Garminuino/issues/22), [#40](https://github.com/skyforcetw/Garminuino/issues/40)). A 2023 bug report describes "a Google Maps notification ongoing on your Android phone with your navigation status" during and after Android Auto sessions ([9to5Google](https://9to5google.com/2023/07/17/android-auto-google-maps-exit-navigation-bug/), secondary).
- **[UNVERIFIED]** Whether the text, the arrow icon and the update rate are identical under Android Auto, on Google Maps as it is in 2026, in English. A Drive Recording made with self mode running would settle it, and the Guidance core tests would show any difference.
- **[UNVERIFIED]** What the phone screen shows. With the phone unlocked in self mode, the receiver's window is the "car screen". Whether Google Maps can also be open on the phone at the same time, or shows a car-mode notice, I couldn't find. Wristpilot's own receiver needs no window, so the phone can sit locked.

---

## 4. Recommendation

**No prototype ticket now.** The decision depends on ticket 09's Map Mirror runs (the device runs moved there from ticket 08):

1. **If the screen-captured Map Mirror doesn't work with the phone unlocked**, stop here: black frames, the Bluetooth link can't carry one frame every 2 s, or 240-at-480 can't be read at a glance. Android Auto changes where frames come from, not the Bluetooth link to the watch or the watch's display, so it can't rescue any of those.
2. **If it works unlocked, and the phone locking is what spoils it in the car**, run one cheap check with the user before any ticket. Open Google's DHU on the Mac (`adb forward tcp:5277 tcp:5277`, "Start head unit server" on the Redmi; [DHU guide](https://developer.android.com/training/cars/testing/dhu)). Start Google Maps navigation in it, lock the Redmi, and watch whether the DHU window keeps moving for 10 minutes. This uses the same server that self mode uses, on the real phone, with Google's own receiver and no code of ours. Repeat once with "Record drive" on, to see whether Google Maps' navigation notification (what the Turn Card is built from) still arrives unchanged.
3. **If the DHU keeps showing Maps while the Redmi is locked**, a prototype ticket is worth writing: a self-mode receiver in the Android forwarder (H.264 only, 800×480, night mode on, no audio sink, crop to the map), feeding the existing Map Mirror frame path. Two things to settle first:
   - **It reaches Google Maps by a different path than ADR 0001 describes.** ADR 0001 reads Google Maps' notification (and, for the Map Mirror, its screen). This would act as a car head unit and take Android Auto's video. It still mirrors Google Maps, and Wristpilot still does no routing of its own, but it depends on an unofficial Android Auto path and on AGPL code. **That needs an ADR, and the user's say-so before one is written.**
   - The daily cost to the driver. Before each Navigation Session they must unlock the phone and start the head unit server by hand (it's a developer menu; whether it survives a reboot is unknown). Plugging in or unplugging the charger mid-session ends the session (§1.1). Some Android Auto update will break it again (§3.1).
4. **If the DHU stops when the Redmi locks**, the Map Mirror stays unlocked-only and Android Auto is closed as an option.

## Open questions

- Does Android Auto keep sending video over the 5277 server with the Redmi locked? (§4, item 2 answers it.)
- Does Google Maps' navigation notification stay the same while Android Auto runs? (A Drive Recording answers it.)
- Does "Start head unit server" stay on across reboots and Android Auto updates on HyperOS 2?
- Could the cluster channel give a map without banners, so no crop is needed?
