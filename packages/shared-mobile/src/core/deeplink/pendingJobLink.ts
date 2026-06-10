import AsyncStorage from '@react-native-async-storage/async-storage';

// A requirement id the user intended to open (from the web /apply page) but
// couldn't be routed to immediately — e.g. they tapped "Apply" before installing
// the app, or before signing in. We stash it and navigate once they're past auth
// + the profile gate, then clear it.
const KEY = 'bmw_pending_job_link';
let _mem: string | null = null;

export async function setPendingJob(id: string): Promise<void> {
  if (!id) return;
  _mem = id;
  try { await AsyncStorage.setItem(KEY, id); } catch { /* ignore */ }
}

export async function getPendingJob(): Promise<string | null> {
  if (_mem) return _mem;
  try { _mem = await AsyncStorage.getItem(KEY); } catch { /* ignore */ }
  return _mem;
}

export async function clearPendingJob(): Promise<void> {
  _mem = null;
  try { await AsyncStorage.removeItem(KEY); } catch { /* ignore */ }
}
