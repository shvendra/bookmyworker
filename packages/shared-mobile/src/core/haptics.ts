// ── Haptic feedback ──────────────────────────────────────────────────────────
// Thin, FAIL-SAFE wrappers around expo-haptics. Haptics are a nice-to-have; a
// device without a vibrator (or a transient error) must never throw or block a
// tap — every call swallows its own errors. Requires the VIBRATE permission
// (already declared) on Android.
import * as Haptics from 'expo-haptics';

/** Light tap — buttons, chips, general presses. */
export const hapticLight = (): void => {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};

/** Medium tap — primary CTAs (unlock contact, call, post). */
export const hapticMedium = (): void => {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
};

/** Success buzz — an action completed (contact unlocked, remark saved, applied). */
export const hapticSuccess = (): void => {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
};

/** Warning buzz — a blocked / limit-reached action. */
export const hapticWarning = (): void => {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
};

/** Selection tick — tab switches, segmented controls, pickers. */
export const hapticSelection = (): void => {
  void Haptics.selectionAsync().catch(() => {});
};
