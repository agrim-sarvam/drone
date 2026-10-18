# Bridge repair verification

The primary deliverable is the Android telemetry bridge. Desktop changes are the matching schema V2 receiver and display/storage integration.

## VERIFIED locally

- Network-only Android app APK and Android instrumentation test APK compile with JDK 17, SDK 33 and the checked-in Gradle wrapper.
- Eight JVM tests pass, including real Java UDP datagrams, test-send while live sending is off, stop/restart destination switching, no-fix serialization, height when joining mid-flight, and a schema fixture shared with the desktop.
- Android lint has zero errors. Existing/new localization, layout and API deprecation warnings remain; a passing lint task is not a claim of zero warnings.
- Packaged APK manifest inspection checks the custom Application, foreground service, application ID and key mode without printing any key.
- A DJI-enabled build without a key fails explicitly instead of publishing MISSING_API_KEY.
- Desktop legacy tests and eleven additional Node regression tests pass: strict field validation, real UDP reception, ordering/recovery, GPS/no-fix, synthetic labels, null-safe display, SQLite migration/record/replay and preservation of old source-checkout data.
- Frontend production build passes. The real Electron source app and Windows packaged executable smoke tests exercise UDP → IPC → valid marker/no-fix/synthetic/stale UI → SQLite recording → replay without renderer exceptions.
- Independent Android, receiver/storage and delivery review passes found the USB attach forwarding omission and source-data relocation gap; both were addressed and the migration tests rerun.

## Automated GitHub checks

`Bridge checks and APK` runs desktop tests/UI smoke, Android build/JVM/lint/manifest checks and an Android API-28 x86 emulator job. The emulator tests launch the mobile app, press the real network-test button and receive its datagram, reject invalid port input, and recreate the Activity while a foreground sender remains active.

`Windows desktop package` builds and smoke-tests the packaged executable. Artifacts include the unsigned portable Windows directory. The Android network artifact is a developer-signed diagnostic APK with DJI registration disabled. It cannot be used as proof of a DJI hardware connection.

The owner must provide DJI_API_KEY and manually run the DJI-enabled build. It does not publish a release or overwrite the old v1.0.0 APK automatically. CI result/run URLs are the source for whether the emulator job passed on a particular commit; compiling instrumentation tests locally is not an emulator pass.

## UNKNOWN / not measured

No actual phone, RC-N1, Air 2S, owner DJI key or operational logs were available. DJI registration, USB/RF compatibility, GPS accuracy, DJI Fly coexistence, screen-off/OEM battery policy, current Android 16-KB-page compatibility and actual flight behavior remain unverified. Initial registration/setup may require Internet; offline operation must be checked after setup while preserving the local network.

Latency, packet loss under real RF/network conditions, CPU, thermal and battery use were not measured. Local loopback tests are correctness checks, not field performance measurements. The code sends telemetry only; the desktop's video remains a clearly labelled demo.

See [CLIENT_SETUP_GUIDE.md](../CLIENT_SETUP_GUIDE.md) for owner build steps, bench testing and reviewed diagnostic export instructions.
