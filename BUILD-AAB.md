# Building the release AABs locally (no Expo / no EAS)

> Claude cannot run this build — it needs your `android/` dirs, your upload
> keystore + passwords, and a ~10‑min Gradle run on your Mac. Everything up to
> here (code merged on `main`, versions set) is done. Run the steps below.

## 0. Pre‑flight

```bash
cd /Users/sonu/Desktop/10/bookmyworker
git checkout main && git pull        # get the fully merged code
```

Confirm both `agent-app/android/` and `employer-app/android/` exist. If they
don't (they're gitignored / were cleaned), regenerate once:

```bash
cd agent-app && npx expo prebuild -p android --clean && cd ..
cd employer-app && npx expo prebuild -p android --clean && cd ..
```

`--clean` regenerates the native project from `app.json` (picks up the new
icons + the 8 new native modules: expo-font, expo-haptics, expo-image,
expo-linear-gradient, expo-splash-screen, @react-native-community/netinfo,
@expo-google-fonts/poppins, expo-updates). Re‑apply any hand edits your
`android/` had (signing config in `gradle.properties`, `google-services.json`
placement, etc.).

## 1. Set the version — the Gradle build reads `android/app/build.gradle`, NOT app.json

**Only needed if you did NOT re‑prebuild in step 0.** After a prebuild, the
values come from `app.json` automatically.

`agent-app/android/app/build.gradle` → `defaultConfig`:
```gradle
versionCode 1321
versionName "12.3.48"
```

`employer-app/android/app/build.gradle` → `defaultConfig`:
```gradle
versionCode 52
versionName "1.0.40"
```

> ⚠️ Play Console: agent max seen = **1315**, employer max seen = **49**, but
> both were "Replaced on Aug 28" — a newer build may be live. Open
> **Play Console → Release history**, read the TOP row's versionCode for each
> app, and make sure yours is **strictly higher**. Bump if needed.

## 2. Build the signed AABs

```bash
cd /Users/sonu/Desktop/10/bookmyworker
./build-release-aabs.sh
```

This runs `./gradlew bundleRelease` in each `android/` and copies the results
to **`~/Desktop/BookMyWorker-AAB-Release/`** with versioned names.

(Manual equivalent, per app:)
```bash
cd agent-app/android && ./gradlew bundleRelease
# → app/build/outputs/bundle/release/app-release.aab
```

## 3. Smoke‑test BEFORE uploading (build APKs, install on a real device)

```bash
cd agent-app/android && ./gradlew assembleRelease   # → app/build/outputs/apk/release/
```
Install both APKs on a phone and check:
- App launches, splash clears (fonts load), no crash
- **Login works** (API reachable — the `www.bookmyworkers.com` fix)
- Dashboard, worker search, notifications open
- The fixes: search‑bar gap is small + safety tip has a ✕ · worker count shows
  full digits `6,70,xxx+` on the Browse Workers tile AND the subscription modal
  · the "Hire Smarter" modal appears only after ~30s on the dashboard, not
  instantly · app‑icon is the role‑branded one (Recruiter / Worker | Supplier)
- Maintenance / offline‑recovery behaviour (from the merged feature)

## 4. Upload

`~/Desktop/BookMyWorker-AAB-Release/*.aab` → Play Console → each app's release.
