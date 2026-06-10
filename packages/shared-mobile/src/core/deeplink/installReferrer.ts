import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { setPendingJob } from './pendingJobLink';

// Deferred deep link (fresh installs): when a worker taps "Apply" on the web
// /apply page WITHOUT the app installed, they go to the Play Store with a
// `referrer=jobid=<id>` tag. Google passes that string to the app on first
// launch via the Play Install Referrer API. We read it ONCE, extract the job id,
// and stash it so the app can open that requirement after sign-in.
//
// The native module is lazy-required so the app still bundles/runs if it isn't
// installed (e.g. the employer app) — in that case this is a silent no-op.
const DONE_KEY = 'bmw_install_referrer_checked';
const JOBID_RE = /(?:^|[?&])jobid=([a-fA-F0-9]{24})/;

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function captureInstallReferrerOnce(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    // Only on the very first launch after install.
    if (await AsyncStorage.getItem(DONE_KEY)) return;
    await AsyncStorage.setItem(DONE_KEY, '1');

    let mod: any = null;
    try { mod = require('react-native-play-install-referrer'); } catch { return; }
    const PlayInstallReferrer = mod?.PlayInstallReferrer ?? mod?.default ?? mod;
    if (!PlayInstallReferrer?.getInstallReferrerInfo) return;

    await new Promise<void>((resolve) => {
      try {
        PlayInstallReferrer.getInstallReferrerInfo((info: any, err: any) => {
          const ref = !err && info ? info.installReferrer : null;
          const m = typeof ref === 'string' ? JOBID_RE.exec(ref) : null;
          if (m && m[1]) void setPendingJob(m[1]);
          resolve();
        });
      } catch {
        resolve();
      }
    });
  } catch {
    /* ignore — deferred deep link is best-effort */
  }
}
