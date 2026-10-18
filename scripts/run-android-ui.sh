#!/usr/bin/env bash
set -u
# The emulator reaches the CI host at 10.0.2.2; the desktop's receiver listens there.
node scripts/host-receiver.cjs listen 14560 host-receiver.json > host-receiver.log 2>&1 &
receiver=$!
sleep 2
cd android-dji-bridge
set +e
./gradlew :app:connectedDebugAndroidTest -PnetworkOnly -Pandroid.testInstrumentationRunnerArguments.hostReceiverPort=14560 \
  --no-daemon --console=plain > ../android-ui.log 2>&1
result=$?
cat ../android-ui.log
adb logcat -d -s AndroidRuntime > ../android-emulator-crashes.log
cd ..
kill -TERM "$receiver"; wait "$receiver"
cat host-receiver.log
if [ "$result" -eq 0 ]; then node scripts/host-receiver.cjs verify host-receiver.json; result=$?; fi
exit "$result"
