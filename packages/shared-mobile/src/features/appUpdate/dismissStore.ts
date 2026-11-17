import AsyncStorage from '@react-native-async-storage/async-storage';

// Remembers which version's "update available" strip the person closed, so it is not shown again for that version
// (it comes back only when a NEWER version is released). Storage problems never block the app — the strip just shows.
const key = (surface: string) => `bmw_update_strip_dismissed_${surface}`;

export async function loadDismissedVersion(surface: string): Promise<string> {
  try { return (await AsyncStorage.getItem(key(surface))) || ''; } catch { return ''; }
}

export async function saveDismissedVersion(surface: string, version: string): Promise<void> {
  try { await AsyncStorage.setItem(key(surface), version); } catch { /* ignore */ }
}

/** Show the strip only for an optional update that the person has not already closed for this exact version. */
export function shouldShowUpdateStrip(opts: { status: string; latestVersion: string; dismissedVersion: string | null; closedNow: boolean }): boolean {
  if (opts.status !== 'optional' || opts.closedNow) return false;
  if (opts.dismissedVersion === null) return false;                 // still reading storage → no flash
  return !(opts.latestVersion && opts.dismissedVersion === opts.latestVersion);
}

// ── "Update available" dialog shown after login ──────────────────────────────────────────────────────────────
// Shown for an optional update once the person is signed in, with Update / Later. It never nags: at most once per
// DIALOG_GAP_MS for the same version, and straight away again when a NEWER version is released. "Later" just closes it.
export const DIALOG_GAP_MS = 24 * 60 * 60 * 1000;
const dialogKey = (surface: string) => `bmw_update_dialog_${surface}`;

export interface DialogMemory { version: string; at: number }

export async function loadDialogMemory(surface: string): Promise<DialogMemory | null> {
  try {
    const raw = await AsyncStorage.getItem(dialogKey(surface));
    if (!raw) return { version: '', at: 0 };
    const p = JSON.parse(raw) as Partial<DialogMemory>;
    return { version: String(p.version || ''), at: Number(p.at) || 0 };
  } catch { return { version: '', at: 0 }; }
}

export async function saveDialogMemory(surface: string, m: DialogMemory): Promise<void> {
  try { await AsyncStorage.setItem(dialogKey(surface), JSON.stringify(m)); } catch { /* ignore */ }
}

export function shouldShowUpdateDialog(opts: {
  status: string; authenticated: boolean; latestVersion: string; memory: DialogMemory | null; now: number; shownThisRun: boolean;
}): boolean {
  if (opts.status !== 'optional' || !opts.authenticated || opts.shownThisRun) return false;
  if (opts.memory === null) return false;                                   // still reading storage
  if (opts.latestVersion && opts.memory.version !== opts.latestVersion) return true; // new version → show right away
  return opts.now - opts.memory.at >= DIALOG_GAP_MS;
}
