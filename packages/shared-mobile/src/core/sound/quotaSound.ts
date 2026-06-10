import { Vibration } from 'react-native';

// Feedback for the last-10-contacts alert: a short built-in Vibration buzz.
// Deliberately NO audio library — a 0.18s beep isn't worth the recording /
// foreground-service permissions those bring (and the Play Store scrutiny that
// follows). VIBRATE is a normal Android permission (auto-granted, no review);
// iOS uses the taptic engine. The CRM (web) plays a real beep via Web Audio.
export function playQuotaAlert(): void {
  try { Vibration.vibrate(300); } catch { /* ignore */ }
}
