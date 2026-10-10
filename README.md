# Wristpilot

Mirrors Google Maps turn-by-turn guidance from an Android phone (the Navigation Phone) onto a Zepp OS watch (Amazfit Active Max). See `CONTEXT.md` for the vocabulary and `.scratch/turn-card/spec.md` for the v1 spec.

```
android/   Android forwarder (Kotlin): reads Google Maps' notification, serves Raw Guidance Snapshots on ws://127.0.0.1:8786
zepp/      Zepp OS project
  app-side/                side service: WebSocket → Guidance core → watch
  app-side/guidance-core/  Guidance core: all navigation logic, pure, tested
  page/                    watch app: renders the Turn Card View it receives
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

The side service runs inside the Zepp app on the phone while Wristpilot is open on the watch.

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

1. Open **Wristpilot** on the phone and tap **Grant notification access**. If Wristpilot is greyed out or you see "Restricted setting", go back.
2. Settings → Apps → Manage apps → **Wristpilot** → ⋮ (top right) → **Allow restricted settings** → confirm.
3. Tap **Grant notification access** again and switch on Wristpilot.
4. The Wristpilot screen now shows "✓ Notification access granted". Once Wristpilot is open on the watch it shows "✓ Watch link up".

To see what Google Maps actually sends: `adb logcat -s WristpilotListener` (one line per post or removal, with its category and ongoing flag).

(The full HyperOS survival checklist, covering autostart, battery saver and locking in Recents, comes with ticket 07.)
