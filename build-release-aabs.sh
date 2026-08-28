#!/bin/bash
# Build SIGNED release AABs (Android App Bundles) for Play Console upload.
# LOCAL Gradle build only — no Expo / no EAS. See BUILD-AAB.md.
# Output → ~/Desktop/BookMyWorker-AAB-Release/  (named with versionName + versionCode)
set -e
export ANDROID_HOME=${ANDROID_HOME:-$HOME/Library/Android/sdk}
ROOT=/Users/sonu/Desktop/10/bookmyworker
OUT="$HOME/Desktop/BookMyWorker-AAB-Release"
mkdir -p "$OUT"

gradle_prop () {  # gradle_prop <app> <versionCode|versionName>
  grep -m1 "$2" "$ROOT/$1/android/app/build.gradle" | sed -E 's/.*'"$2"'[[:space:]]+"?([^"]+)"?.*/\1/'
}

build_app () {
  local APP="$1" LABEL="$2" OUTNAME="$3"
  echo "================= BUILDING $LABEL (AAB) ================="
  if [ ! -d "$ROOT/$APP/android" ]; then
    echo "ERROR: $APP/android/ missing. Run 'npx expo prebuild -p android --clean' in $APP first (see BUILD-AAB.md)."
    exit 1
  fi
  cd "$ROOT/$APP/android"
  local VN VC
  VN=$(gradle_prop "$APP" versionName)
  VC=$(gradle_prop "$APP" versionCode)
  echo "[$LABEL] versionName=$VN  versionCode=$VC"

  echo "[$LABEL] 1/3 worklets prefab (no clean)…"
  ./gradlew :react-native-worklets:assembleRelease -q || true
  echo "[$LABEL] 2/3 force fresh JS bundle…"
  rm -rf app/build/generated/assets/createBundleReleaseJsAndAssets \
         app/build/intermediates/assets/release \
         app/build/intermediates/merged_assets/release \
         app/build/ASSETS "$TMPDIR"/metro-* "$TMPDIR"/haste-* 2>/dev/null || true
  echo "[$LABEL] 3/3 bundleRelease (AAB)…"
  ./gradlew bundleRelease

  local SRC="app/build/outputs/bundle/release/app-release.aab"
  local DST="$OUT/${OUTNAME}-${VN}-vc${VC}.aab"
  cp "$SRC" "$DST"
  echo "[$LABEL] DONE → $DST  ($(du -h "$DST" | cut -f1))"
}

build_app agent-app    AGENT    BookMyWorker-Agent
build_app employer-app  EMPLOYER BookMyWorker-Recruiter

echo
echo "ALL DONE — AABs in: $OUT"
ls -la "$OUT"/*.aab
echo
echo "⚠️  Verify each versionCode is HIGHER than the top row of Play Console →"
echo "    Release history before uploading (agent seen 1315, employer seen 49,"
echo "    both replaced Aug 28 → a newer build may be live)."
