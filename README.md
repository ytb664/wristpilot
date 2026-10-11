# Wristpilot

Mirrors Google Maps turn-by-turn guidance from an Android phone (the Navigation Phone) onto a Zepp OS watch (Amazfit Active Max). See `CONTEXT.md` for the vocabulary and `.scratch/turn-card/spec.md` for the v1 spec.

```
android/   Android forwarder (Kotlin): reads Google Maps' notification, serves Raw Guidance Snapshots on ws://127.0.0.1:8786
zepp/      Zepp OS project
  app-side/                side service: WebSocket → Guidance core → watch
  app-side/guidance-core/  Guidance core: all navigation logic, pure, tested
  page/                    watch app: renders the Turn Card View it receives
zepp/scripts/timeline.js   prints a drive recording as a readable timeline
scripts/env.sh             puts the project-local Android toolchain on PATH
```

## Toolchain (nothing installed globally)

- **Node** (any recent version, tested with 24). Zepp tools (`zeus`) are local dev dependencies in `zepp/`.
- **JDK 17 + Gradle** in a conda env:
  ```sh
  conda create -n wristpilot -c conda-forge openjdk=17 gradle=8.10
  ```
- **Android SDK** in `.tooling/android-sdk` (gitignored), next to the main checkout:
  ```sh
  mkdir -p .tooling/android-sdk/cmdline-tools && cd .tooling
  curl -LO https://dl.google.com/android/repository/commandlinetools-mac-11076708_latest.zip
  unzip commandlinetools-mac-*_latest.zip -d android-sdk/cmdline-tools
  mv android-sdk/cmdline-tools/cmdline-tools android-sdk/cmdline-tools/latest
  JAVA_HOME="$(conda info --base)/envs/wristpilot/lib/jvm" \
    android-sdk/cmdline-tools/latest/bin/sdkmanager --sdk_root="$PWD/android-sdk" \
    "platforms;android-35" "build-tools;35.0.0" "platform-tools"
  ```

## Guidance core tests

```sh
cd zepp && npm install && npm test
```

## Watch app + side service (Zepp OS)

1. On the phone, in the Zepp app: Profile → Settings → About → tap the Zepp icon 7 times to enable **Developer Mode**.
2. Build and install:
   ```sh
   cd zepp
   npm install
   npx zeus login        # Zepp account, once
   npx zeus preview      # pick "Amazfit Active Max", then scan the QR code in Zepp → Developer Mode → Scan
   ```
   `npx zeus build` alone produces a `.zab` in `zepp/dist/`. `npx zeus dev` runs it in the simulator.
3. On the watch, open **Wristpilot** from the app list. With no Navigation Session it shows the Waiting Screen ("Waiting for Google Maps").

The side service runs inside the Zepp app on the phone while Wristpilot is open on the watch. It reconnects to the Android forwarder by itself after any drop, and also when the forwarder stops sending its 2 s heartbeat (HyperOS froze it), so the watch shows the Stale Turn Card instead of an old Maneuver.

### Opening Wristpilot on the watch

**"Navigation started" notification.** When Google Maps starts giving directions, the Android forwarder posts a "Navigation started" phone notification, and Zepp mirrors it to the watch. For that, switch on Wristpilot in Zepp: Device → Active Max → Notifications and Reminders → Notifications.

What to expect from tapping it on the watch: **most likely it's only a reminder.** Zepp OS documents opening a Mini Program from a notification only for notifications the Mini Program posts itself on the watch (`@zos/notification`, Zepp OS 3+). It documents nothing for notifications mirrored from the phone, and the Active Max manual only describes viewing and deleting them. So tapping probably shows the message and nothing more; open Wristpilot with the button shortcut. _(To be confirmed on the watch in ticket 09.)_

**Button shortcut (the reliable way).** On the watch: Settings → Preferences → Shortcut Buttons → pick the button → **Wristpilot**. Pressing and holding that button then opens Wristpilot. Do it before driving: Wristpilot shows the Waiting Screen and switches to the Turn Card by itself when navigation starts.

## Android forwarder (debug APK)

```sh
source scripts/env.sh
cd android
echo "sdk.dir=$ANDROID_HOME" > local.properties
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk   # or copy the APK to the phone and open it
```

### Android 15 / HyperOS 2: notification access for a sideloaded app

Android 15 blocks notification access for apps installed outside a store until you allow restricted settings. This only applies when you open the APK from a browser, chat app or file manager. An `adb install` is not restricted, so if you installed that way, skip step 2.

1. Open **Wristpilot** on the phone and tap **Open notification access** (under "Setup for HyperOS"). If Wristpilot is greyed out or you see "Restricted setting", go back.
2. Settings → Apps → Manage apps → **Wristpilot** → ⋮ (top right) → **Allow restricted settings** → confirm.
3. Tap **Open notification access** again and switch on Wristpilot.
4. The Wristpilot screen now shows "✓ Notification access granted". Once Wristpilot is open on the watch it shows "✓ Watch link up".

To see what Google Maps actually sends: `adb logcat -s WristpilotListener` (one line per post or removal, with its category and ongoing flag).

### Keeping Wristpilot alive on HyperOS 2

HyperOS freezes and kills background apps. On 2026-10-11 it froze the forwarder a minute into a drive and held back 12 minutes of Google Maps updates (ticket 02). Two defences:

- **During a Navigation Session the forwarder runs a foreground service** (the quiet "Forwarding Google Maps to the watch" notification) and holds a partial wake lock, from the first Google Maps navigation notification until it's removed. It starts by itself: Android runs the notification listener without the app being opened.
- **The setup checklist** on the Wristpilot phone screen, under "Setup for HyperOS". Each step shows ✓ / ✗ when Android lets Wristpilot check (• when it can't) and has a button to the right settings page:
  1. Allow restricted settings (only for a non-adb install).
  2. Notification access for Wristpilot.
  3. Wristpilot may post notifications (for "Navigation started" and the foreground service).
  4. Autostart on for Wristpilot.
  5. Battery optimization off for Wristpilot. Android only lets an app start a foreground service from the background in a few cases, and this is the one that fits; without it, the screen says "Android refused to keep Wristpilot awake".
  6. Battery saver "No restrictions" for Wristpilot.
  7. Battery saver "No restrictions" for Zepp (it runs the side service).
  8. Zepp sends Wristpilot's notifications to the watch.
  9. Lock Wristpilot and Zepp in Recents (no settings page: long-press each card in Recents and tap the lock).

The screen also shows whether the watch link is up (the side service is connected), when the last Google Maps update arrived, and whether the forwarder is being kept awake now.

To check a drive for freezes, record it (below) and run `npm run timeline` on it: snapshots "delivered N s late" mean the forwarder was frozen.

## Drive Recordings (test fixtures)

The Guidance core is tested against real drives recorded on the Navigation Phone.

1. Open **Wristpilot** on the phone and switch **Record drive** on before you start directions.
2. Drive with Google Maps as usual. Every Google Maps notification post and removal is saved, including a 120×120 copy of the Maneuver arrow (48×48 before format v4).
3. Switch **Record drive** off when you're done. Each on/off is one file, `drive-YYYYMMDD-HHMMSS.jsonl` (one Raw Guidance Snapshot per line).
4. Get it off the phone: tap the recording in the list to share it (Drive, Telegram, email…), or over USB:
   ```sh
   adb pull /sdcard/Android/data/dev.wristpilot.forwarder/files/recordings/
   ```
5. Read it:
   ```sh
   cd zepp && npm run timeline -- path/to/drive-20261011-081500.jsonl
   ```

6. To test the Guidance core against it, put it in `zepp/app-side/guidance-core/fixtures/` and run `npm test` from `zepp/`: every recording there is replayed (`drives.test.js`).

Recordings are **never committed**: they hold the real streets of each drive and this repo is public. `.gitignore` keeps them out, and a local pre-push hook (`.git/hooks/pre-push`, word list in `.git/private-words`) refuses any push that mentions a listed place. Without recordings the replay tests skip.

