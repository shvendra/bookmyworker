#!/bin/bash
# Build SIGNED release AABs (Android App Bundles) for Play Console upload.
# Mirrors build-test-apks.sh but produces .aab via bundleRelease and uses the
# correct repo root for this checkout.
set -e
export ANDROID_HOME=${ANDROID_HOME:-$HOME/Library/Android/sdk}
ROOT=/Users/sonu/Desktop/10/bookmyworker

build_app () {
  local APP="$1" LABEL="$2"
  echo "================= BUILDING $LABEL (AAB) ================="
  cd "$ROOT/$APP/android"
  echo "[$LABEL] 1/3 worklets prefab (no clean)…"
  ./gradlew :react-native-worklets:assembleRelease -q || true
  echo "[$LABEL] 2/3 force fresh JS bundle…"
  rm -rf app/build/generated/assets/createBundleReleaseJsAndAssets \
         app/build/intermediates/assets/release \
         app/build/intermediates/merged_assets/release \
         app/build/ASSETS "$TMPDIR"/metro-* "$TMPDIR"/haste-* 2>/dev/null || true
  echo "[$LABEL] 3/3 bundleRelease (AAB)…"
  ./gradlew bundleRelease
  echo "[$LABEL] DONE → $(ls -la app/build/outputs/bundle/release/app-release.aab)"
}

build_app agent-app AGENT
build_app employer-app EMPLOYER

# Copy to clearly-named, versioned files at the repo root
AV=$(grep versionName "$ROOT/agent-app/android/app/build.gradle" | head -1 | sed -E 's/.*"([^"]+)".*/\1/')
EV=$(grep versionName "$ROOT/employer-app/android/app/build.gradle" | head -1 | sed -E 's/.*"([^"]+)".*/\1/')
cp "$ROOT/agent-app/android/app/build/outputs/bundle/release/app-release.aab"    "$ROOT/BookMyWorker-Agent-v${AV}.aab"
cp "$ROOT/employer-app/android/app/build/outputs/bundle/release/app-release.aab" "$ROOT/BookMyWorker-Employer-v${EV}.aab"
echo "ALL DONE"
ls -la "$ROOT"/BookMyWorker-*.aab
