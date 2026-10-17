import { Platform } from 'react-native';

/**
 * Thin, FAIL-SAFE wrapper over the Google Play in-app update flow
 * (expo-in-app-updates). Lets a user update without leaving the app.
 *
 * Every call degrades to "didn't start" (`false`) — never throws — when:
 *   - not Android,
 *   - the native module isn't in this build,
 *   - the build wasn't installed from Play (sideload / internal APK),
 *   - Play reports no newer version, or the flow can't be started.
 * Callers then fall back to opening the Play Store listing, i.e. exactly the
 * behaviour the app had before.
 */
interface InAppUpdatesModule {
  checkForUpdate: () => Promise<{ updateAvailable: boolean; immediateAllowed?: boolean; flexibleAllowed?: boolean }>;
  startUpdate: (isImmediate?: boolean) => Promise<boolean>;
}

function loadModule(): InAppUpdatesModule | null {
  if (Platform.OS !== 'android') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-in-app-updates') as InAppUpdatesModule;
  } catch {
    return null;
  }
}

/** Does Google Play have a newer build for this install? false on any failure. */
export async function isPlayUpdateAvailable(): Promise<boolean> {
  const mod = loadModule();
  if (!mod) return false;
  try {
    const info = await mod.checkForUpdate();
    return info?.updateAvailable === true;
  } catch {
    return false;
  }
}

/**
 * Start the Play in-app update. `immediate` = full-screen, blocking flow (for the
 * mandatory gate); otherwise a flexible background download that restarts the app
 * when ready. Resolves true only if Play actually started the flow.
 */
export async function startInAppUpdate(immediate: boolean): Promise<boolean> {
  const mod = loadModule();
  if (!mod) return false;
  try {
    const info = await mod.checkForUpdate();
    if (!info?.updateAvailable) return false;
    // Prefer the requested flow, but accept whichever Play allows for this install.
    const wantImmediate = immediate ? info.immediateAllowed !== false : info.flexibleAllowed === false;
    return (await mod.startUpdate(wantImmediate)) === true;
  } catch {
    return false;
  }
}
