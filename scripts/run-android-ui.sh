#!/usr/bin/env bash
set -u
cd android-dji-bridge
set +e
./gradlew :app:connectedDebugAndroidTest -PnetworkOnly --no-daemon --console=plain > ../android-ui.log 2>&1
result=$?
cat ../android-ui.log
adb logcat -d -s AndroidRuntime > ../android-emulator-crashes.log
exit "$result"
