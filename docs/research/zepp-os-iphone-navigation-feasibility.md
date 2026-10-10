# Feasibility: Zepp OS watch + Google Maps navigation on iPhone

**Date:** 2026-10-11
**Question:** Can a Zepp OS watch app get live turn-by-turn directions and a mini map from Google Maps navigation running on an iPhone? If not, what is the closest practical design?

**Short answer:** No. iOS has no channel that lets a third-party app (including the Zepp app's JS side service) read Google Maps' navigation state, its screen, or its Live Activity. The only data that leaves iOS for a non-Apple watch is ordinary notifications over ANCS, and those are text only. I found no primary source saying Google Maps on iOS posts a notification for each turn. The closest practical design is for Wristpilot to **do its own routing**: the side service gets the route and maneuvers from a routing API that is *not* Google (Mapbox, or a self-hosted OSM engine), the watch's own GPS tracks progress, and the watch draws the route line on `CANVAS`, optionally over map images downloaded from the same provider. Google Maps then becomes at most a voice-only companion on the phone, and it does not feed the watch.

Conventions: every claim links to its source. **[UNVERIFIED]** marks a claim I could not trace to a primary source. **[INFERENCE]** marks my own reasoning from cited facts.

---

## 1. iOS restrictions: can a third-party app see another app's screen, notifications or navigation state?

### 1.1 App sandbox
- "Sandboxing is designed to prevent apps from gathering or modifying information stored by other apps", and each app gets its own home directory. An app reaches anything outside its sandbox "only by using services explicitly provided by iOS". ([Apple Platform Security: Security of runtime process](https://support.apple.com/guide/security/sec15bfe098e/web))
- The notification API covers only the calling app's own notifications. `getDeliveredNotifications` "Fetches all of **your app's** delivered notifications that are still present in Notification Center." ([UNUserNotificationCenter.getDeliveredNotifications](https://developer.apple.com/documentation/usernotifications/unusernotificationcenter/getdeliverednotifications(completionhandler:))) No public iOS API reads another app's notifications. **[INFERENCE]** I found no Apple page that lists such an API, and the sandbox statement above rules one out.
- The Zepp side service is JavaScript that "runs in the Zepp App on mobile devices" ([Zepp OS architecture](https://docs.zepp.com/docs/guides/architecture/arc/)), so it is bound by the Zepp iOS app's sandbox. Its documented API surface is small: Messaging, Fetch, Settings Storage, Download File, Image Convert, TransferFile and console. None of these reads notifications, other apps, the screen or the phone's location. ([Side Service API index: fetch page sidebar](https://docs.zepp.com/docs/reference/side-service-api/fetch/), [Side Service intro](https://docs.zepp.com/docs/guides/framework/side-service/intro/))
- Screen capture: ReplayKit supports broadcast extensions that receive video sample buffers ([ReplayKit](https://developer.apple.com/documentation/replaykit), [RPBroadcastSampleHandler](https://developer.apple.com/documentation/replaykit/rpbroadcastsamplehandler)), and the user has to start the broadcast from a picker ([RPSystemBroadcastPickerView](https://developer.apple.com/documentation/replaykit/rpsystembroadcastpickerview)). In theory a separate Wristpilot iOS app could screen-record Google Maps and OCR the turn card. **[UNVERIFIED]** I did not confirm the extension's memory and CPU limits, whether it can keep running for a long drive, or how App Review would treat it. The Zepp side service cannot host such an extension in any case. I consider this impractical (see §6).

### 1.2 ANCS (Apple Notification Center Service): what Zepp/Amazfit watches can receive
- ANCS exists to give "Bluetooth accessories (that connect to iOS devices through a Bluetooth low-energy link) a simple and convenient way to access many kinds of notifications that are generated on iOS devices". ([ANCS Introduction](https://developer.apple.com/library/archive/documentation/CoreBluetooth/Reference/AppleNotificationCenterServiceSpecification/Introduction/Introduction.html))
- The Notification Source characteristic reports when an iOS notification is **added, modified or removed**, along with a CategoryID and a count. "Due to the nature of iOS, the ANCS is not guaranteed to always be present." ([ANCS Specification](https://developer.apple.com/library/archive/documentation/CoreBluetooth/Reference/AppleNotificationCenterServiceSpecification/Specification/Specification.html))
- The only attributes an accessory can request are **AppIdentifier, Title, Subtitle, Message, MessageSize, Date, PositiveActionLabel and NegativeActionLabel**, all as UTF-8 strings. There are no images or icons and no rich or structured payload. **No "Navigation" category exists**: the categories are Other, IncomingCall, MissedCall, Voicemail, Social, Schedule, Email, News, HealthAndFitness, BusinessAndFinance, Location and Entertainment. ([ANCS Appendix](https://developer.apple.com/library/archive/documentation/CoreBluetooth/Reference/AppleNotificationCenterServiceSpecification/Appendix/Appendix.html))
- Because of the "modified" event, an app that *updates* one notification in place could in principle stream changing text to a watch. That only helps if Google Maps actually posts such a notification on iOS (see §2.2).
- **[UNVERIFIED]** Amazfit's iOS documentation never names ANCS. Its troubleshooting pages tell iPhone users to enable all alerts for the Zepp app, to set "Show Previews" to "When Unlocked", and to turn on the "Other" toggle. They also say watch alerts mirror what appears in the phone's notification area. ([Amazfit: cannot receive notifications](https://us.amazfit.com/pages/what-should-i-do-if-i-cannot-receive-notifications), [Active 2 (Round) page](https://support.amazfit.com/en/amazfit_active_2(round)/docs/X4DXdZFpFojW4Rxv4WScIln7n1g)) **[INFERENCE]** ANCS is the only documented path for another app's notifications to reach a BLE accessory, so the watch's iOS notifications almost certainly arrive over ANCS, outside any third-party mini-app's control. I found no Zepp OS device API that lets a mini-app read the watch's incoming notification feed. The `@zos/notification` module only *posts* notifications ([notify](https://docs.zepp.com/docs/reference/device-app-api/newAPI/notification/notify/)).

### 1.3 Background execution on iOS (relevant to the side service)
- iOS suspends most apps shortly after they move to the background. Continuous background location for navigation is an explicitly supported use case, but it needs the "Location updates" background mode and a background activity session. ([Handling location updates in the background](https://developer.apple.com/documentation/corelocation/handling-location-updates-in-the-background))
- Without a qualifying background mode, extra background time is finite: if `endBackgroundTask` is not called in time, "the system kills the app". ([beginBackgroundTask](https://developer.apple.com/documentation/uikit/uiapplication/beginbackgroundtask(withname:expirationhandler:)))
- Background modes must be declared in `UIBackgroundModes` ([UIBackgroundModes](https://developer.apple.com/documentation/bundleresources/information-property-list/uibackgroundmodes)). Wristpilot cannot add modes to the Zepp app. Whatever modes Zepp declares govern how long its side service lives.

---

## 2. Google Maps on iOS

### 2.1 URL schemes and SDKs: launch-only, no state read-back
- `comgooglemaps://` and Universal Links can **launch** Google Maps and request directions or navigation. `comgooglemaps-x-callback://` returns control to the calling app "when Google Maps completes an action". The documentation describes no way to read navigation progress. ([Google Maps URL Scheme for iOS](https://developers.google.com/maps/documentation/urls/ios-urlscheme))
- Google Maps exposes no public API, SDK or intent that streams its *consumer app's* navigation state to other apps. **[INFERENCE]** None is documented on the URL-scheme page, and the sandbox (§1.1) would block one anyway.

### 2.2 Per-turn notifications and Live Activities
- Google announced "glanceable directions" (next turn and ETA on the route overview or lock screen) on 2023-02-08, saying it "will also be compatible with Live Activities on iOS 16.1". ([Google blog, Feb 8 2023](https://blog.google/products-and-platforms/products/maps/sustainable-immersive-maps-announcements/)) **[UNVERIFIED]** I found no current Google Help page that confirms the iOS Live Activity is generally available today. Secondary reports describe a staggered or tested rollout.
- **[UNVERIFIED]** No primary source says Google Maps on iOS posts a standard notification per turn. Google's iOS navigation help page mentions only that "You'll still hear voice directions" with the screen off ([Use navigation, iPhone](https://support.google.com/maps/answer/3273406?hl=en&co=GENIE.Platform%3DiOS)). This needs an empirical test (Open questions).
- **Live Activities are not notifications.** Apple documents them as UI shown "in the Dynamic Island, on the Lock Screen, in CarPlay, and on a paired Mac or Apple Watch" ([Displaying live data with Live Activities](https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities)), and they are managed through ActivityKit's `Activity` object ([Activity](https://developer.apple.com/documentation/activitykit/activity)). The ANCS attribute and category tables (§1.2) have no Live Activity concept. **[UNVERIFIED]** Apple never says explicitly that "ANCS does not carry Live Activities", but nothing in the ANCS spec covers them, and the only non-iPhone targets Apple lists are Apple devices. Conclusion: even if Google Maps uses a Live Activity, it will not reach a Zepp watch.
- Contrast with Android: open-source projects there *do* read Google Maps' ongoing navigation notification through Android's notification-listener permission and re-post or bridge it to Amazfit watches (§5). That technique has no iOS equivalent.

### 2.3 Google Navigation SDK and Google Maps Platform terms
- The Navigation SDK for iOS embeds Google turn-by-turn navigation *inside your own iOS app* ([Navigation SDK overview](https://developers.google.com/maps/documentation/navigation/ios-sdk/overview)). It provides a turn-by-turn data feed (`didChangeNavInfo`, `GMSNavigationNavInfo`, step info, lanes, maneuvers) intended "for small screen displays" and two-wheeler riders ([iOS turn-by-turn data feed](https://developers.google.com/maps/documentation/navigation/ios-sdk/nav-only-feed)). Technically this is the only Google-sanctioned source of live Google maneuvers. It would need a separate native Wristpilot iOS app, not the Zepp side service.
- Its policies say it "is allowed only for commercial applications", disallow certain uses without consent, and require the Google map and logos to be displayed unaltered ([Navigation SDK for iOS policies](https://developers.google.com/maps/documentation/navigation/ios-sdk/policies)). Navigation Request pricing is $25 per 1,000 after 1,000 free per month ([GMP pricing](https://developers.google.com/maps/billing-and-pricing/pricing)). **[INFERENCE]** For a hobby or personal app the "commercial only" clause is a blocker. Projecting onto a watch is not explicitly allowed or forbidden.
- Terms that matter for any Google-data design ([Google Maps Platform Terms §3.2.3](https://cloud.google.com/maps-platform/terms), last modified 2026-08-26):
  - (a) No scraping, which includes not "pre-fetch, index, store, reshare, or rehost Google Maps Content outside the services".
  - (b) No caching except as the service-specific terms permit.
  - (d)(iv) No re-creating Google products: the example given is not to "combine data from the Directions API, Geolocation API, and Maps SDK for Android to create real-time navigation functionality substantially similar to" Google Maps for Android.
  - (e) No use with non-Google maps: "Customer will not use the Google Maps Core Services with or near a non-Google Map".
  - (f) No use in embedded vehicle systems.
- Service-specific terms for **Routes API (§19)**, **Directions API (§4)** and **Navigation SDK (§12)** each say content may be used *without* a Google map but "must not [be used] in conjunction with a non-Google map", and lat/lng may be cached for at most 30 days. ([Maps Service Specific Terms](https://cloud.google.com/maps-platform/terms/maps-service-terms), last modified 2026-06-10)
- **[INFERENCE]** Two consequences follow:
  - Google routes drawn over Mapbox or OSM tiles on the watch violate §3.2.3(e) and §19.2. Google routes with *no map* (an arrow plus a breadcrumb on a blank canvas) are allowed under §19.1.
  - Showing Google Static Maps on the watch means downloading images, converting them and transferring them into watch storage. That plausibly conflicts with the no-storing and no-caching clauses (a) and (b). Get legal confirmation before relying on it.

---

## 3. Zepp OS capabilities

### 3.1 API levels and devices
- API_LEVEL arrived with Zepp OS 2.0. Zepp OS 1.0 devices do not support it, and mini-apps built against API_LEVEL do not run on 1.0. ([API_LEVEL compatibility](https://docs.zepp.com/docs/guides/framework/device/compatibility/))
- Zepp OS 3.0 added the features this project needs: App Service (background), the CANVAS widget, **two-way file transfer** between device app and side service, **side-service file download and image conversion**, a system notification API, and more sensors including Geolocation. ([New features in 3.0](https://docs.zepp.com/docs/guides/version-info/new-features-30/))
- Screens from the official device table ([Device basic information](https://docs.zepp.com/docs/reference/related-resources/device-list/)):

  | Shape | Resolution | Examples (latest API_LEVEL) |
  | --- | --- | --- |
  | Round | 480×480 | Balance 3 (4.4), Balance Ultra (4.4), Cheetah 2 Ultra (4.3), T-Rex Ultra 2 (4.2), Active Max (4.2), T-Rex 3 (4.0), Balance 2 (4.2), Balance (3.7), Cheetah Pro (3.6) |
  | Round | 466×466 | Active 2 Round (4.2), Active 3 Premium (4.2), Cheetah 2 Pro (4.3), T-Rex 3 Pro 44mm (4.2), GTR 4 (3.6) |
  | Round | 454×454, 416×416, 360×360 | Cheetah Round / T-Rex Ultra (3.6), Falcon (3.6), Active Edge (3.5) |
  | Square | 390×450 | Active 2 Square (4.2), Bip 6 (4.2), Active (3.6), GTS 4 (3.6) |
  | Square | 432×514 | Bip Max (4.4) |
  | Square | 320×380 | Bip 5 Unity (3.0), Bip 5 (2.1) |

  **Target: API_LEVEL ≥ 3.0** for file transfer and image conversion. In practice that means 2023+ devices at 466/480 round and 390×450 square.
- **GPS hardware:** the device table has no GPS column. The `checkSensor(Geolocation)` API detects availability at runtime ([checkSensor](https://docs.zepp.com/docs/reference/device-app-api/newAPI/sensor/checkSensor/)). **[UNVERIFIED]** Which models ship GPS should be checked against each model's Amazfit spec page. Most current Active, Balance, T-Rex, Cheetah and Bip models are marketed with built-in GNSS.

### 3.2 Watch side (Device App)
- **Geolocation:** available from API_LEVEL 2.1 with permission `device:os.geolocation`. It provides `start`, `getStatus` ("A" valid, "V" invalid), `getLatitude` and `getLongitude` (WGS-84), and an `onChange` callback. From 3.0 it adds `getSetting` (accuracy or power modes) and GNSS satellite info. ([Geolocation](https://docs.zepp.com/docs/reference/device-app-api/newAPI/sensor/Geolocation/)) I found no documented heading or speed getter on this sensor. A `Compass` sensor exists ([sensor list](https://docs.zepp.com/docs/reference/device-app-api/newAPI/sensor/Geolocation/)). **[UNVERIFIED]** Update rate and accuracy at driving speeds are not documented.
- **Geolocation is foreground-only.** App Service (background) cannot use "High-power sensors, including Accelerometer, Geolocation, Gyroscope". A single App Service execution is limited to 600 ms. ([App Service limitations](https://docs.zepp.com/docs/guides/framework/device/app-service/)) The watch app therefore has to stay in the foreground during a drive.
- **Keeping the screen on:** `setPageBrightTime` accepts up to about 2,147,483,000 ms per page ([setPageBrightTime](https://docs.zepp.com/docs/reference/device-app-api/newAPI/display/setPageBrightTime/)), and `pauseDropWristScreenOff` suspends wrist-down screen-off ([pauseDropWristScreenOff](https://docs.zepp.com/docs/reference/device-app-api/newAPI/display/pauseDropWristScreenOff/)).
- **Rendering:**
  - `IMG` (API 2.0) supports `angle` rotation and `auto_scale`, and recommends 24-bit or 32-bit PNG *assets* ([IMG](https://docs.zepp.com/docs/reference/device-app-api/newAPI/ui/widget/IMG/)).
  - `CANVAS` (API 3.0) draws lines, points, rects, ellipses, arcs, **polygons**, images (`drawImage`) and text, with up to three stacked layers ([CANVAS](https://docs.zepp.com/docs/reference/device-app-api/newAPI/ui/widget/CANVAS/)).
  - The documented widget list includes `GRADIENT_POLYLINE`, but **no map widget** ([widget docs sidebar](https://docs.zepp.com/docs/reference/device-app-api/newAPI/ui/widget/IMG/)).
- **Image format:** "The Device App can not show png images due to the limitation of device". A downloaded PNG must go through the side service's `image.convert` first, which converts it "to image formats supported by the Device App". ([Image Convert](https://docs.zepp.com/docs/reference/side-service-api/image-convert/)) **[UNVERIFIED]** The docs do not name the target format (it is often said to be TGA-based). Bundled assets are converted at build time by the toolchain, which explains why the IMG page recommends PNG.

### 3.3 Phone side (Side Service)
- It runs inside the Zepp App with no UI, has the lifecycle `onInit`, `onRun` and `onDestroy`, and talks to the watch over BLE ([architecture](https://docs.zepp.com/docs/guides/architecture/arc/), [register](https://docs.zepp.com/docs/guides/framework/side-service/register/)).
- `fetch()` accepts only url, method, headers and body, and on some models `res.body` may arrive as a string ([Fetch API](https://docs.zepp.com/docs/reference/side-service-api/fetch/)). `network.downloader.downloadFile` saves to `data://download` ([Download File](https://docs.zepp.com/docs/reference/side-service-api/download-file/)). `transferFile.getOutbox().enqueueFile(path, params)` sends a file to the watch with progress and state events ([Side TransferFile](https://docs.zepp.com/docs/reference/side-service-api/transfer-file/)), and the watch receives it through `@zos/ble/TransferFile` inbox events (API 3.0) ([Device TransferFile](https://docs.zepp.com/docs/reference/device-app-api/newAPI/transfer-file/TransferFile/)).
- **The side service has no geolocation API**, so it cannot read the iPhone's GPS. The documented modules are listed in §1.1. **[INFERENCE]** Position must come from the watch.
- **Messaging:** Messaging is binary-only ([Messaging API](https://docs.zepp.com/docs/reference/side-service-api/messaging/)). The official ZML library chunks messages with `MESSAGE_SIZE = 3600` bytes ([zml src/shared/message.js](https://github.com/zepp-health/zml/blob/main/src/shared/message.js)). **[UNVERIFIED]** No primary source gives BLE throughput figures. Measure it.
- **iOS background lifetime: [UNVERIFIED]**, and this is the biggest platform risk. Zepp's docs say nothing about whether the side service keeps running, or keeps network access, while the Zepp iOS app is backgrounded or the phone is locked. Community reports (not Zepp staff) say Zepp must be allowed to run in the background on iPhone for full functionality ([discussion #125](https://github.com/orgs/zepp-health/discussions/125)), and that in the simulator the side service sometimes fails to start unless it is started manually from the Zepp app ([discussion #478](https://github.com/orgs/zepp-health/discussions/478)). Amazfit's own troubleshooting tells users to enable "Run in the Background" in Zepp ([Amazfit support](https://us.amazfit.com/pages/what-should-i-do-if-i-cannot-receive-notifications)). **[INFERENCE]** If Zepp's iOS app holds a Bluetooth background mode, BLE events may wake it. Whether the JS runtime gets enough time to run `fetch` and image conversion while the phone is locked has to be tested on a real device.

---

## 4. Alternatives: own routing plus map imagery

| | Google Routes API | Mapbox Directions API |
| --- | --- | --- |
| Turn data | `RouteLegStep.navigationInstruction` (maneuver enum plus instruction text), encoded polyline ([computeRoutes reference](https://developers.google.com/maps/documentation/routes/reference/rest/v2/TopLevel/computeRoutes)) | `steps=true` with `banner_instructions` and `voice_instructions` (SSML plus trigger distance), polyline geometry ([Directions API](https://docs.mapbox.com/api/navigation/directions/)) |
| Free tier / price | Compute Routes Essentials: 10,000 free per month, then $5.00 per 1,000. Pro (traffic-aware): 5,000 free, then $10.00 per 1,000 ([GMP pricing](https://developers.google.com/maps/billing-and-pricing/pricing)) | 100,000 requests free per month, then $2.00 per 1,000 ([Mapbox pricing](https://www.mapbox.com/pricing)) |
| Limits | Per [Routes usage and billing](https://developers.google.com/maps/documentation/routes/usage-and-billing) | 300 requests/min, 25 waypoints ([Directions API limits](https://docs.mapbox.com/api/navigation/directions/)) |
| Display terms | May be used *without* a map, but **not with a non-Google map**. Lat/lng cache ≤30 days ([Service Terms §19](https://cloud.google.com/maps-platform/terms/maps-service-terms)). The "re-creating navigation" clause applies (§2.3) | Must show Mapbox and OSM attribution (§1.4.1). "Customer shall not export, download, cache or store results from any request to a Navigation API" (§2.10.1). Default restriction §1.9(v): no caching or storing of results ([Mapbox Product Terms, 2026-07-21](https://www.mapbox.com/legal/product-terms)) |

| Map imagery | Google Maps Static API | Mapbox Static Images / Static Tiles |
| --- | --- | --- |
| Size | Up to 640×640, `scale=2`. Paths accept encoded polylines (`enc:`). URL limit 16,384 chars ([Maps Static start](https://developers.google.com/maps/documentation/maps-static/start), [usage](https://developers.google.com/maps/documentation/maps-static/usage-and-billing)) | Images 1–1280 px per side, `@2x`, png/jpeg/webp, server-side overlays including paths ([Static Images](https://docs.mapbox.com/api/maps/static-images/)). Tiles 512 px default, 6,000 requests/min ([Static Tiles](https://docs.mapbox.com/api/maps/static-tiles/)) |
| Free tier / price | 10,000 per month, then $2.00 per 1,000. 2D Map Tiles: 100,000 free, then $0.60 per 1,000 ([GMP pricing](https://developers.google.com/maps/billing-and-pricing/pricing)) | Static Images: 50,000 free per month. Static Tiles: 200,000 free per month ([Mapbox pricing](https://www.mapbox.com/pricing)) |
| Terms risk | No scraping, storing or caching (§3.2.3 a/b) | No caching or storing of results (§1.9(v)) |

- **OSM fallback:** `tile.openstreetmap.org` permits only normal interactive viewing, forbids prefetching and offline use, requires a unique User-Agent and visible attribution, and warns that commercial users' access "may be withdrawn at any point" ([OSMF tile usage policy](https://operations.osmfoundation.org/policies/tiles/)). For anything beyond a prototype, self-host the tiles or use a commercial OSM provider.
- **Data size per request: [UNVERIFIED]** I did not measure this. Rough estimates to check in the prototype:
  - A 240×240 PNG street map is likely 20–60 KB, and the converted on-watch format may be larger (uncompressed RGBA at 240×240 is about 230 KB).
  - A Directions JSON with steps, banners and voice instructions for a 20 km drive is likely 20–100 KB. The side service should reduce it to a compact maneuver list plus a decimated polyline (a few KB) before sending it over BLE.
- **[INFERENCE] Provider choice:** keep routing and imagery from **one provider** to avoid Google §3.2.3(e). Mapbox is the cleanest fit (largest free tier, banner and voice instructions built for turn-by-turn). Its no-store and no-cache language still makes transferring images into watch storage a gray area. The alternative is a fully OSM stack (self-hosted OSRM or Valhalla plus self-hosted tiles), which removes licence risk at the cost of running servers. **[UNVERIFIED]** I did not research OSRM or Valhalla instruction formats here.

---

## 5. Existing Zepp OS navigation and map apps

[awesome-zeppos](https://github.com/zepp-health/awesome-zeppos) lists **no** navigation, map, GPS, GPX or notification-mirroring apps. Its closest entries are the MessageBuilder BLE library and a txt-file transfer tool. The projects below came from searching GitHub directly. Each is a primary source for its own behaviour only.

| Project | Platform | How it gets data | How it renders | iOS? |
| --- | --- | --- | --- | --- |
| [ring-amazfit/Ring-Map](https://github.com/ring-amazfit/Ring-Map) (Zepp OS 3.0+, round 466/480) | Android companion + Zepp mini-app | Android NotificationListener reads **Amap/Baidu** navigation notifications. The Android app runs a local WebSocket server, and the side service connects to `ws://127.0.0.1:8886` (`app-side/index.js`), then relays to the watch with MessageBuilder | 152 px maneuver icons, distance and road text. No map | No: depends on Android notification access |
| [LiberiFatali/starpath](https://github.com/LiberiFatali/starpath) | Android only, no watch app | Reads **Google Maps** navigation notifications and re-posts simplified cards ("▶▶ / street / DEST 450 m · 6 min") that the Zepp app mirrors as ordinary notifications | Text and arrow glyphs in the system notification UI | "iOS (StarPath is Android-only)" ([COMPATIBILITY.md](https://github.com/LiberiFatali/starpath/blob/main/docs/COMPATIBILITY.md)) |
| [satvikpandurangi/MiBandNavigator](https://github.com/satvikpandurangi/MiBandNavigator) | Android | Android notification listener on Google Maps, re-formatted alerts sent via Zepp Life or Zepp | ASCII arrows and emoji in notifications | No |
| [Notify for Google Maps](https://www.mibandnotify.com/help/zeppos_googlemaps.php) (closed source) | Android + Zepp OS watch app | Needs notification access on Android. Watch and phone talk over "local connections between Zepp and Notify app" | Not described in text | Not mentioned; setup is Android-only |
| [CuberQAQ/MapTest](https://github.com/CuberQAQ/MapTest) (API 3.0, experimental) | Zepp mini-app | Watch `Geolocation` for position. Watch requests tiles; side service runs `network.downloader.downloadFile`, then (optionally) `image.convert`, then `transferFile` outbox, and the watch shows them in `IMG` tile widgets (320 px tiles, 3×3 viewport) | Raster tile mosaic plus point layer. **Closest existing proof of the Wristpilot rendering path** | Untested |
| [Gared/zeppos-map-creator](https://github.com/Gared/zeppos-map-creator) | Desktop tool | Wraps Gadgetbridge tools to build offline map packages from OSM `.pbf` for Zepp OS's built-in maps | System map app, not available to third-party apps | n/a |
| [spaceshiptrip/zepp-bipmax-mapoverlay-venux1](https://github.com/spaceshiptrip/zepp-bipmax-mapoverlay-venux1) | Workout extension | n/a | Notes that the built-in offline map is closed firmware with no third-party API, and ended up using a static PNG ([NOTES.md §3](https://github.com/spaceshiptrip/zepp-bipmax-mapoverlay-venux1/blob/main/NOTES.md)) | n/a |

**Pattern:** every live "Google Maps on Amazfit" bridge I found is Android-only and depends on Android's notification-listener permission. None works on iOS.

### Built-in Zepp and Amazfit navigation
- **Route import:** GPX, TCX and KML files can be opened in the Zepp app and sent to the watch. Navigation runs from "My Routes" or "My POIs" during supported outdoor activities ([Amazfit: How to use navigation?](https://support.amazfit.com/en/amazfit_t-rex_3/docs/YIKVdXyA5oF5j9xZZXychDOwnBd)).
- **Komoot:** you link komoot from your Zepp profile to "Sync routes to your Zepp app and Amazfit smartwatch". Compatible models include Active 2, Balance, Cheetah, Falcon, GTR 4, GTS 4, T-Rex 2/3/Ultra ([komoot.com/amazfit](https://www.komoot.com/amazfit)). The flow is to plan ahead and sync the route, not to mirror live phone navigation.
- **[UNVERIFIED]** I found no primary Zepp or Amazfit source for any built-in feature that mirrors **Google Maps** (or any phone navigation app) to the watch on iOS. A StarPath implementation note claims "image forwarding on Amazfit is a 2026 iOS-only beta limited to newer watches" ([IMPLEMENTATION.md](https://github.com/LiberiFatali/starpath/blob/main/docs/IMPLEMENTATION.md)). That is a secondary claim and should be verified.

---

## 6. Verdict and closest practical designs

**Verdict:** Reading live turn-by-turn data or a mini map *from Google Maps on iPhone* into a Zepp OS app is **not feasible**:
- The sandbox blocks access to other apps' state.
- ANCS carries only text notifications, has no navigation category and no Live Activities.
- I found no evidence that Google Maps on iOS posts per-turn notifications.
- The side service has no API to read notifications, the screen or GPS.

Wristpilot has to produce its own route guidance.

The architectures below are ranked by practicality.

### A. Own routing in the side service, watch GPS, watch rendering (recommended)
How it works:
1. The user picks a destination: preset favourites in the Settings App, or a short list on the watch.
2. The side service calls **Mapbox Directions** (`steps`, `banner_instructions`, `geometries=polyline6`) and reduces the response to a compact maneuver list plus a decimated polyline, sent over ZML.
3. The watch, kept in the foreground with the screen held on, reads `Geolocation`, snaps the position to the polyline and advances maneuvers locally.
4. The watch draws a next-turn arrow and distance, plus a heading-up **route polyline on `CANVAS`**.

The mini map has two options:
- (A1) **Vector only:** route line, position and upcoming turn geometry on a blank canvas. This is robust, needs no tiles, has the lowest licence risk, and also works with Google Routes under §19.1.
- (A2) **Raster underlay:** the side service periodically fetches a small Mapbox Static Image centred on the last position, converts it and transfers it. The watch shows it through `IMG` with `angle` rotation. The cadence depends on transfer speed.

Rerouting: the watch detects off-route and asks the side service for a new route.

- **Feasibility:** high on the watch side. MapTest demonstrates the download, convert, transfer and IMG path, and the ANCS and terms analysis shows nothing blocking a vector-only design.
- **iOS caveats:** everything after the initial route fetch has to work with the Zepp app backgrounded and the phone locked. Rerouting and A2 imagery need side-service network access in the background **[UNVERIFIED]**. The design should degrade gracefully: the whole route is cached on the watch at start, so guidance continues without the phone.
- **Prototype first:**
  1. Side-service liveness and `fetch` with the iPhone locked for 30+ minutes while driving.
  2. Watch GPS fix rate and accuracy at driving speeds, and battery drain with the screen on.
  3. BLE transfer time for a 240×240 converted image and a 5 KB route payload.
  4. The legal reading of Mapbox §1.9(v) and §2.10.1 for on-watch use.

### B. Own iOS companion app plus local bridge (hybrid, higher effort)
How it works: a native Wristpilot iOS app runs the navigation, either Mapbox Navigation SDK or Google Navigation SDK with its turn-by-turn data feed. It keeps running in the background under the "Location updates" mode (documented by Apple, §1.3) and pushes maneuvers to the Zepp side service. Ring-Map shows the bridge pattern on Android: the companion app hosts a localhost WebSocket and the side service connects to it.

- **Feasibility:** medium. It gives the best guidance quality, uses phone GPS and saves watch battery.
- **iOS caveats:**
  - **[UNVERIFIED]** Whether the side-service runtime on iOS exposes `WebSocket` or can reach `127.0.0.1`, and whether both apps stay alive together.
  - The Google Navigation SDK is commercial-only (§2.3).
  - It is two apps, and the user must still drive with Wristpilot's app, not Google Maps.
- **Prototype first:** a localhost WebSocket or HTTP call from the Zepp side service on iOS to a backgrounded companion app.

### C. Route or GPX import into the built-in navigation (no code, already works)
How it works: plan in komoot or another tool, sync through the Zepp app (komoot integration or GPX import), and follow the route line on the watch's built-in navigation. On newer models this can sit over offline maps.

- **Feasibility:** works today on supported models.
- **iOS caveats:** none found. It is not live Google guidance, has no traffic-aware rerouting, and is built for outdoor sport modes rather than driving.
- **Prototype first:** nothing to build. Use it as the baseline to beat, or the fallback to recommend.

### D. Notification glance (not viable on iOS)
How it works: rely on Google Maps notifications forwarded over ANCS, or a Wristpilot app re-posting them.

- **Feasibility:** effectively zero on iOS:
  - No per-turn notification from Google Maps on iOS is documented.
  - The Live Activity does not travel over ANCS.
  - No iOS app can read Google Maps' notifications in order to re-post them.
  - The ReplayKit screen-capture-and-OCR variant is fragile and has App Review risk (§1.1).
- **Prototype first:** only the 10-minute empirical check in Open questions #1, to close this out.

---

## Open questions
1. Does Google Maps on current iOS post **any** standard notification during navigation (lock the phone mid-route, then check Notification Center and whether "Google Maps" appears in Zepp → App Alerts)? If it does, what does the text look like, and is it updated in place (ANCS "modified")?
2. Does the Zepp side service on iOS keep running, with working `fetch` and `downloadFile`, while Zepp is backgrounded and the phone is locked for a whole drive? Does `onDestroy` fire when the watch app is closed?
3. What are the real BLE throughput and latency for `transferFile` and for ZML messages (3,600-byte chunks) on iOS, and how long does a converted 240×240 map image take?
4. What GPS update rate and accuracy does `Geolocation` give at 50–100 km/h, and what is the battery cost of GPS plus an always-on screen for an hour?
5. Does the iOS side-service runtime support `WebSocket` and loopback (`127.0.0.1`) connections to another app (needed for B)?
6. Licensing: under Mapbox §1.9(v) and §2.10.1, may the watch hold a route and static images for the duration of a single trip? Would a Google "route on blank canvas, no map" design (Routes API §19.1) clear §3.2.3(d)'s "re-creating Google products" clause?
7. What does `image.convert` produce (format and bytes per pixel), and can `CANVAS.drawImage` draw a transferred file from `data://`?
