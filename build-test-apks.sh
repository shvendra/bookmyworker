#!/bin/bash
set -e
export ANDROID_HOME=${ANDROID_HOME:-$HOME/Library/Android/sdk}
ROOT=/Users/sonu/Desktop/10/bookmyworker
OUT="$HOME/Desktop/BookMyWorker-APK-Test"
mkdir -p "$OUT"

build_app () {
  local APP="$1" LABEL="$2"
  echo "================= BUILDING $LABEL ================="
  cd "$ROOT/$APP/android"
  echo "[$LABEL] 1/3 worklets prefab (no clean)…"
  ./gradlew :react-native-worklets:assembleRelease -q
  echo "[$LABEL] 2/3 force fresh JS bundle…"
  rm -rf app/build/generated/assets/createBundleReleaseJsAndAssets \
         app/build/intermediates/assets/release \
         app/build/intermediates/merged_assets/release \
         app/build/ASSETS "$TMPDIR"/metro-* "$TMPDIR"/haste-* 2>/dev/null || true
  echo "[$LABEL] 3/3 assembleRelease (APK)…"
  ./gradlew assembleRelease
  echo "[$LABEL] DONE → $(ls -la app/build/outputs/apk/release/app-release.apk)"
}

build_app agent-app AGENT
build_app employer-app EMPLOYER

# Copy to a clearly-named Desktop folder
AV=$(grep versionName "$ROOT/agent-app/android/app/build.gradle" | head -1 | sed -E 's/.*"([^"]+)".*/\1/')
EV=$(grep versionName "$ROOT/employer-app/android/app/build.gradle" | head -1 | sed -E 's/.*"([^"]+)".*/\1/')
AC=$(grep versionCode "$ROOT/agent-app/android/app/build.gradle" | head -1 | sed -E 's/[^0-9]*([0-9]+).*/\1/')
EC=$(grep versionCode "$ROOT/employer-app/android/app/build.gradle" | head -1 | sed -E 's/[^0-9]*([0-9]+).*/\1/')
cp "$ROOT/agent-app/android/app/build/outputs/apk/release/app-release.apk"    "$OUT/BookMyWorker-Agent-${AV}-vc${AC}.apk"
cp "$ROOT/employer-app/android/app/build/outputs/apk/release/app-release.apk" "$OUT/BookMyWorker-Recruiter-${EV}-vc${EC}.apk"
echo "ALL DONE — APKs in: $OUT"
ls -la "$OUT"/*.apk
