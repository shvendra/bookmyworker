const { withAndroidManifest } = require("@expo/config-plugins");

// expo-audio is only used here for simple in-app promotion-ad playback (see
// PromotionOverlay.tsx: useAudioPlayer only, no recording, no
// setAudioModeAsync/shouldPlayInBackground, no lock-screen controls). Its
// AudioControlsService (foregroundServiceType="mediaPlayback") and
// AudioRecordingService (foregroundServiceType="microphone") are therefore
// unused, but Play Console's Android 15 "restricted foreground service
// types" check flags them anyway because expo-notifications also declares a
// BOOT_COMPLETED receiver. Strip both services from the manifest so a fresh
// `expo prebuild` keeps producing a clean manifest, same as the hand-edited
// android/app/src/main/AndroidManifest.xml.
const REMOVED_SERVICES = [
  "expo.modules.audio.service.AudioControlsService",
  "expo.modules.audio.service.AudioRecordingService",
];

module.exports = function withoutUnusedAudioForegroundServices(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    if (!application?.service) return config;

    for (const name of REMOVED_SERVICES) {
      const existing = application.service.find((s) => s.$?.["android:name"] === name);
      if (existing) {
        existing.$["tools:node"] = "remove";
      } else {
        application.service.push({ $: { "android:name": name, "tools:node": "remove" } });
      }
    }

    return config;
  });
};
