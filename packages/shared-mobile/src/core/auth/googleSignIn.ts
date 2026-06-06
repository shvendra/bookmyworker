import { ENV } from '../config/env';

// Google Sign-In native module is OPTIONAL. It's lazy-required so the app keeps
// bundling and running even when the module isn't installed yet — in that case
// `isGoogleSignInAvailable()` returns false and no Google UI is shown. Nothing
// in the existing app is affected until you install the module AND set
// EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.
//
// To enable:
//   1. npm i @react-native-google-signin/google-signin (in employer-app)
//   2. Add the Android google-services.json + your release SHA-1 in Google Cloud
//   3. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID to the Web client ID, then rebuild.

/* eslint-disable @typescript-eslint/no-explicit-any */
let GoogleSignin: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  GoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin;
} catch {
  GoogleSignin = null;
}

let configured = false;
function ensureConfigured(): boolean {
  if (!GoogleSignin || !ENV.GOOGLE_WEB_CLIENT_ID) return false;
  if (!configured) {
    GoogleSignin.configure({ webClientId: ENV.GOOGLE_WEB_CLIENT_ID, offlineAccess: false });
    configured = true;
  }
  return true;
}

export function isGoogleSignInAvailable(): boolean {
  return !!GoogleSignin && !!ENV.GOOGLE_WEB_CLIENT_ID;
}

// Returns a Google ID token, or null if cancelled / unavailable.
export async function signInWithGoogle(): Promise<string | null> {
  if (!ensureConfigured()) return null;
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  try {
    // Sign out first so the account chooser always shows (avoids silent re-use).
    await GoogleSignin.signOut().catch(() => {});
  } catch {
    /* ignore */
  }
  const result: any = await GoogleSignin.signIn();
  // Supports both legacy ({ idToken }) and v13+ ({ data: { idToken } }) shapes.
  return result?.idToken ?? result?.data?.idToken ?? null;
}
