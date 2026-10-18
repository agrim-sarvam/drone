# Sentinel DJI bridge: owner setup and friend handoff

This project is an offline desktop map/recording application. The Android bridge reads DJI aircraft state through Mobile SDK V4 and forwards telemetry over local UDP. It does not forward live camera video, control the aircraft, or read DJI Fly's screen. The desktop's video pane is labelled DEMO VIDEO.

## Quick start (bench test, about 20 minutes)

You need: the **DJI-enabled** APK (not the network-test one), the laptop running this branch, phone + USB **data** cable, RC-N1, Air 2S with **propellers removed**.

**Laptop**

1. Get this branch and start the app:
   ```powershell
   git fetch origin; git checkout <branch-or-main-after-merge>; git pull
   npm ci; npm ci --prefix client; npm run build --prefix client
   npm start
   ```
   If `npm ci` fails with a `node-gyp`/Python error, run `npm ci --ignore-scripts` then `node node_modules/electron/install.js` (the native modules ship prebuilt binaries).
2. Allow UDP 14550 through Windows Firewall once (PowerShell **as Administrator**; hotspot networks are often marked Public, which blocks the usual prompt):
   ```powershell
   New-NetFirewallRule -DisplayName "Sentinel DJI telemetry" -Direction Inbound -Protocol UDP -LocalPort 14550 -Action Allow -Profile Private,Public
   ```
   Remove later with `Remove-NetFirewallRule -DisplayName "Sentinel DJI telemetry"`.
3. Put laptop and phone on the same Wi-Fi, or connect the laptop to the **phone's hotspot** (most reliable in the field).
4. Hardware Connection → **DJI SDK (UDP)**, IP `0.0.0.0`, port `14550` → **Connect to Drone**. Note the address shown after **Enter on phone:** (use the Wi-Fi/hotspot one).

**Phone, without the drone**

5. Uninstall any older Sentinel bridge, then install the new APK. Open it with **Internet available** (first DJI registration needs it) and grant all permissions. The top line must become **DJI SDK: REGISTERED**. If it shows `REGISTRATION FAILED code=…`, stop and send that code.
6. Enter the laptop address and port `14550`, press **SEND STATIC TEST PACKET**. The laptop must show **SYNTHETIC NETWORK TEST**. If not: wrong IP, firewall, or the Wi-Fi blocks device-to-device traffic (guest Wi-Fi) — try the phone hotspot.

**With the drone (props off)**

7. Fully close DJI Fly. Power on Air 2S and RC-N1, plug the phone into the RC. When Android asks which app opens the DJI accessory, choose **Sentinel DJI Bridge**. Wait for **Aircraft: CONNECTED** and an updating **Sample age**.
8. Press **START UDP**. The phone shows **Route: Wi-Fi …** (or *system default* on phone hotspot) and **Packets sent** increasing with **Send errors: 0**.
9. Laptop shows **RECEIVING, WAITING FOR GPS FIX** indoors; outdoors with GPS it shows **RECEIVED** and the drone marker on the map. Compare battery and position with the drone.
10. Press **SAVE DIAGNOSTIC REPORT** on the phone and **Save receiver report** on the laptop, and send both files back whether it worked or not.

Important: while the bridge owns the RC's USB connection, **DJI Fly cannot use it** — no live camera view from DJI Fly. Fly only with visual line of sight and normal safety procedures.

**Phone and firmware.** Use an Android 10–14 phone (DJI SDK V4 does not support Android 15+). The SDK was tested by DJI with Air 2S firmware 02.04.25.00; note the aircraft and RC-N1 firmware versions shown in DJI Fly before the test and include them in the report.

**Registration errors** (shown on the phone's top line):

| Message contains | Meaning / fix |
|---|---|
| bundle / package not match | DJI key was created for a different package; it must be `com.sentinel.cop.dji` |
| invalid / not exist / empty app key | wrong key in the build — rebuild with the correct `DJI_API_KEY` |
| connect to internet / timeout | first registration needs Internet; connect the phone and retry |
| max activation | the DJI developer account's activation limit (20 devices on basic accounts) is used up |

## 1. Owner: obtain the two matching applications

1. Review and merge the bridge repair branch (both Android and desktop changes are required for schema V2).
2. In DJI Developer, register an Android Mobile SDK application for package **`com.sentinel.cop.dji`**. Obtain that application's API key. This requires the owner's account; the repository cannot manufacture a valid key.
3. In the GitHub repository, open **Settings → Secrets and variables → Actions → New repository secret**. Name it **`DJI_API_KEY`** and paste the key as its value. Do not put it in an issue, commit, workflow input, screenshot or chat. The key necessarily exists in the built APK; it is not an authentication credential for the laptop UDP receiver.
4. Open **Actions → Bridge checks and APK → Run workflow**. Choose the repair branch (or main after merging), enable **Build DJI-enabled APK**, and run it.
5. Wait for green desktop, Android network-test and DJI APK jobs. Download **`dji-enabled-apk-and-reports`** from that run's Artifacts. Extract `app-debug.apk` and its checksum. This is an installable developer/test APK, not a production-signed store release.
6. Do **not** give the friend the **network-test** APK as a DJI bridge. Its different package ends in `.networktest`, its version says network-test, and DJI registration is deliberately disabled. That APK is useful to test local Wi-Fi and the map without a DJI key or drone.
7. Download the matching **Windows desktop** artifact from **Windows desktop package** in Actions (or build locally as below). Extract the whole portable application folder; do not copy only the executable. Old desktop builds reject schema V2.
8. Keep the commit/run URL and checksums with the delivered files. Use the same run/commit for both apps. These CI APKs use development signing. A fresh runner can use a different debug certificate; if Android reports an incompatible update, save diagnostics and uninstall the old test app before installing. For maintained production distribution, the owner must configure a stable signing key and validate the real hardware matrix first.

Public repositories permit reading, not pushing. A contributor without write access works in a fork and sends the owner a pull request. Secrets do not transfer to a fork. The owner can run the workflow in their repository after merging.

## 2. Friend: install and establish the local network

1. Install the supplied **DJI-enabled** `app-debug.apk` on the Android phone, allowing installation from that source when Android requests it. Check its version is 1.1.0 and the screen does not say NETWORK TEST ONLY.
2. Extract and open the matching Windows desktop application.
3. Put the phone and laptop on the same local Wi-Fi, or connect the laptop to the phone's hotspot. Internet is needed for initial DJI registration/setup. Normal telemetry uses the local network, not the Internet.
4. On Windows run `ipconfig`. Find the **IPv4 Address of the active Wi-Fi/hotspot connection**, for example `192.168.43.25`. Do not use the gateway, `127.0.0.1`, a disconnected adapter, VPN address or `0.0.0.0` as the phone's destination.
5. In the desktop Hardware Connection panel choose **DJI SDK (UDP)**, listener IP **`0.0.0.0`**, port **`14550`**, timeout **`3000`**, then **Connect to Drone**. This opens a listener; it does not mean a drone is connected.
6. Allow the intended application on the intended Windows private network if the firewall prompts. Do not disable the firewall globally. Guest Wi-Fi/client isolation can prevent local communication even when both devices have Internet.
7. On the phone enter the laptop's IPv4 address and port **14550**. Nothing starts automatically when the aircraft connects.

## 3. Prove phone → laptop without a drone

1. Leave real UDP transmission stopped on the phone.
2. Press **SEND STATIC TEST PACKET**. The phone should say the test was sent and ask you to confirm it on the laptop. That message is not a delivery acknowledgement.
3. The laptop should show **SYNTHETIC NETWORK TEST**, platform **SYNTHETIC_NETWORK_TEST**, and a synthetic position near Delhi. This deliberately is not the real aircraft's position. Do not treat it as aircraft telemetry.
4. One packet times out after the configured timeout. That is expected. Send another test packet to repeat the check.
5. If the laptop shows no test packet, fix the local network/IP/firewall/port first. Aircraft registration is unrelated to this test. Check Receiver diagnostics: received/rejected packet counts and last error.
6. Disconnect/reconnect the laptop receiver after the synthetic test to clear test display before checking a real aircraft.

## 4. Connect the DJI aircraft on the bench

1. Remove propellers for the initial bench check. Power on the Air 2S and its compatible RC-N1 controller. Use a USB **data** cable between controller and Android phone.
2. Close DJI Fly for the first bridge test. Select Sentinel when Android asks which app should handle the DJI USB accessory and grant access. Do not assume DJI Fly and this bridge can simultaneously own the USB connection. If simultaneous Fly operation is a requirement, validate it separately before using this arrangement operationally.
3. Open Sentinel, grant its required permissions, and keep Internet available for initial registration. After denial, grant permissions in Android Settings and use **RETRY DJI REGISTRATION / PERMISSIONS**.
4. Verify **DJI SDK: REGISTERED** and **Aircraft: CONNECTED**. If registration fails, record its numeric SDK error code and export diagnostics; repeatedly pressing START UDP will not fix registration.
5. With UDP still stopped, verify that the phone receives aircraft samples. Sample age should update; battery should be plausible. Outdoors, wait for usable GPS. **WAITING FOR FIX** is an honest state and must not create a fake `(0,0)` map marker. Zero coordinates can be legitimate when the SDK reports a valid fix.
6. Press **START UDP** only after the saved laptop IP/port are correct. Check the effective destination and sent/error counters. The foreground notification provides a **Stop UDP** action. Android notification permission is optional for the sender but recommended for visibility.
7. The laptop should show **RECEIVED** for valid GPS or **RECEIVING, WAITING FOR GPS FIX** while GPS is unavailable. Compare position, heading, battery and speed. **Height above takeoff** is DJI's barometric takeoff-relative height; it is not MSL or height above terrain.
8. To change the IP/port, press **STOP UDP**, edit the destination and press **START UDP** again. Fields are locked while sending. A network-test send never changes a live stream's destination.
9. If packets stop, the laptop labels data **STALE**. A last-known marker is not evidence the aircraft is still there. When data returns, verify the fresh status and sample age.
10. Test USB unplug/replug, controller off/on, Wi-Fi interruption, phone rotation and screen lock on the bench. A foreground service keeps the sender independent of Activity recreation. Force-stop, process death, OEM battery restrictions or reboot may stop it; reopen and explicitly start again. Background/screen-off continuity is not a hardware-tested guarantee.
11. Only after these checks pass, perform an appropriate controlled flight with the normal pilot and flight-safety procedures. This bridge is telemetry-only and adds no flight-control failsafe. Check altitude when connecting after takeoff: it must retain height above the actual takeoff point, not reset to zero.

## 5. Offline maps, recording and replay

The desktop uses a local `map.mbtiles`; without it, a fallback grid appears. A grid is not proof that geographical map data is installed. Use a compatible raster PNG MBTiles file that covers the location/zoom levels. The packaged app reads it from its user-data `data` folder, normally **`%APPDATA%\drone\data\map.mbtiles`** (verified Electron app name: `drone`; display name: Sentinel COP). Restart after adding the file. The SQLite flight database is in the same folder. When updating a source checkout, existing database/WAL/map files are copied there only if the destination is absent; originals are preserved. Close the old app before upgrading.

After real telemetry works, start recording, capture a short stationary session, stop recording and replay it. Check altitude reference, missing-GPS states and synthetic labels remain correct. Old recordings retain an explicit unknown/legacy altitude reference; the software cannot reconstruct a missing historical datum. The bridge schema is versioned and the desktop still accepts V1 packets, but labels their altitude reference unspecified.

After successful initial registration and setup, disable Internet while preserving the local Wi-Fi/hotspot link. Check cold launch, maps, real telemetry, recording and replay again. Do not turn off Wi-Fi itself when testing Internet independence.

## 6. Logs you can inspect in GitHub

### Build/test logs (available without any drone)

Open **Actions**, choose the run, then open the failed job/step. Download the reports artifact for unit-test XML, HTML reports, lint results and build logs. Android manifest checks verify the application loader, service, package and key mode without printing the key. GitHub checks compile and test the code; they do not prove real DJI registration, RF/USB compatibility or flight performance.

### Phone and laptop diagnostics (friend chooses when to share)

1. On the phone choose **SAVE DIAGNOSTIC REPORT**, then choose a local file destination. It contains build revision, Android/device version, registration outcome/error code, aircraft/UDP state, counters, sample age and a bounded event history. It excludes GPS coordinates, destination IP, raw telemetry and the DJI key. Exception reports keep exception classes and code frames, not exception messages.
2. On the laptop expand **Receiver diagnostics (no coordinates)** and choose **Save receiver report**.
3. Review the files before sharing. Create a GitHub issue using **Bridge connection problem**, include the commit/run URL and device/firmware versions, and drag in the reports or paste their text. Do not attach the database, flight paths, raw packet captures, keys or unreviewed full Android logs to a public issue.
4. For an early startup crash that prevents report export, a developer can use `scripts/collect_android_logs.ps1` with Android platform-tools installed and USB debugging enabled. This saves AndroidRuntime logs locally. Those full crash logs may contain sensitive information; review/redact before uploading.

There is no automatic public runtime upload and the phone needs no GitHub login. Use a private support channel if device information is sensitive. Local UDP is unauthenticated; use a trusted local network. A public GitHub issue is not an appropriate location for flight data.

## 7. Developer build and tests

Requirements: Node 24, JDK 17, Android SDK platform 33/build tools (Gradle wrapper included). Keep `JAVA_HOME` pointed at JDK 17 for Gradle 7.5.1.

```powershell
npm ci
npm test
npm ci --prefix client
npm run build --prefix client
# Installable network-only diagnostic build. DJI is deliberately disabled.
cd android-dji-bridge
.\gradlew.bat :app:assembleDebug :app:testDebugUnitTest :app:lintDebug -PnetworkOnly
```

For a real DJI build, omit `-PnetworkOnly` and supply `DJI_API_KEY` through the environment or `dji.api.key` in ignored `android-dji-bridge/local.properties`. Never commit the key. The build fails without it. Do not substitute a fake string merely to obtain a green build. After building run `python scripts/verify_apk.py <apk>` (add `--network-only` for that mode). APK path: `android-dji-bridge/app/build/outputs/apk/debug/app-debug.apk`.

Build the Windows package from repository root after tests: `npx electron-builder --win --dir`. The pinned SQLite and serial-port packages ship N-API prebuilds; unnecessary source rebuilds are disabled. Both source and packaged executable smoke tests exercise the shipped native modules. Native Electron packaging and installed-app startup should be checked separately from the frontend build.

## Verification limits

Automated tests cover the real Java UDP sender/one-shot test, schema fixture shared with Node, no-fix/null handling, mid-flight altitude conversion, receiver parsing/ordering/timeouts/recovery, SQLite migration/recording/replay and display formatting. An APK build is not a hardware test. No code change can establish DJI key validity, the friend's phone/firmware/USB compatibility, DJI Fly coexistence, map availability or operational reliability without their bench evidence. The app uses DJI Mobile SDK V4 4.18, the final V4 release (adapted to Android 13 and 14; Air 2S is not supported by SDK V5). DJI has stated V4 will not support Android 15 or 16 KB memory-page devices, so prefer a phone on Android 10–14. Do not claim every Android phone is supported.
