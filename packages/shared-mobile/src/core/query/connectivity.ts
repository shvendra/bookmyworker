import { AppState, type AppStateStatus } from 'react-native';
import { onlineManager } from '@tanstack/react-query';
import { API_ORIGIN } from '../config/env';

/**
 * React-Native connectivity → React Query onlineManager bridge, plus a small
 * pub/sub so the UI can render a full-screen "No Internet" overlay.
 *
 * WHY THIS EXISTS / WHAT WAS BROKEN
 * ---------------------------------
 * Previously connectivity was inferred ONLY from app traffic + a HEAD probe.
 * Two failure modes made the app "never recover, even on manual retry":
 *   1. When onlineManager is offline, React Query PAUSES every query — so a
 *      manual "Try again" (refetch) did nothing (paused, not fetching).
 *   2. If the HEAD probe never cleanly succeeded when the network returned, the
 *      app stayed stuck offline forever.
 *
 * THE FIX
 * -------
 *   • @react-native-community/netinfo is the PRIMARY, reliable signal — it fires
 *     the instant the OS regains connectivity, so recovery is automatic.
 *   • Traffic signals (reportNetworkOk/Down) and an AppState re-check remain as
 *     secondary signals.
 *   • forceOnlineRecheck() lets the "Try again" button optimistically flip online
 *     and re-probe, so the button can NEVER be a dead no-op.
 *   • NetInfo is loaded defensively — if the native module is somehow absent, we
 *     silently fall back to the traffic + probe approach instead of crashing.
 */

let currentlyOnline = true;
let recoveryTimer: ReturnType<typeof setTimeout> | null = null;
let installed = false;

const listeners = new Set<(online: boolean) => void>();

const PROBE_TIMEOUT_MS = 5000;
const RECOVERY_POLL_MS = 4000;

// A cheap reachability probe. ANY HTTP response (even 4xx/5xx) proves the network
// is back; only a fetch rejection (no response at all) means still offline.
async function isReachable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    try {
      await fetch(`${API_ORIGIN}/api/v1/health`, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });
      return true;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return false;
  }
}

function stopRecoveryPoll(): void {
  if (recoveryTimer) {
    clearTimeout(recoveryTimer);
    recoveryTimer = null;
  }
}

function scheduleRecoveryPoll(): void {
  if (recoveryTimer) return; // already polling
  recoveryTimer = setTimeout(async function tick() {
    recoveryTimer = null;
    if (currentlyOnline) return;
    if (await isReachable()) {
      setOnline(true);
    } else if (!currentlyOnline) {
      recoveryTimer = setTimeout(tick, RECOVERY_POLL_MS);
    }
  }, RECOVERY_POLL_MS);
}

function setOnline(online: boolean): void {
  if (online === currentlyOnline) return;
  currentlyOnline = online;
  // Flips React Query's online state. On a false→true transition this fires a
  // reconnect, so every query with refetchOnReconnect refetches automatically.
  onlineManager.setOnline(online);
  if (online) stopRecoveryPoll();
  else scheduleRecoveryPoll();
  listeners.forEach((fn) => {
    try {
      fn(online);
    } catch {
      /* a listener must never break connectivity */
    }
  });
}

/** The API client saw a server response → the network is up. */
export function reportNetworkOk(): void {
  setOnline(true);
}

/** The API client hit a network-level failure (no response) → treat as offline. */
export function reportNetworkDown(): void {
  setOnline(false);
}

/** Current connectivity, for first render of the overlay. */
export function getOnline(): boolean {
  return currentlyOnline;
}

/** Subscribe to connectivity changes. Returns an unsubscribe fn. */
export function subscribeOnline(fn: (online: boolean) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Manual "Try again": optimistically flip online (un-pauses React Query so the
 * subsequent refetch actually runs), then verify with a real probe and correct
 * if we are genuinely still offline. Guarantees the retry button is never a
 * silent no-op — the classic "reload does nothing" bug.
 */
export async function forceOnlineRecheck(): Promise<boolean> {
  setOnline(true); // un-pause queries so a refetch can fire
  const ok = await isReachable();
  if (!ok) setOnline(false); // genuinely offline → back to offline + resume polling
  return ok;
}

/**
 * Wire connectivity into React Query. Idempotent — safe to call at module load.
 */
export function installConnectivityManager(): void {
  if (installed) return;
  installed = true;

  // PRIMARY signal: real OS connectivity via NetInfo. Loaded defensively so a
  // missing native module degrades to the traffic/probe fallback rather than
  // crashing the app at startup.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const NetInfo = require('@react-native-community/netinfo').default;
    NetInfo.configure({
      reachabilityUrl: `${API_ORIGIN}/api/v1/health`,
      reachabilityTest: async (response: Response) => response.status >= 200 && response.status < 600,
    });
    NetInfo.addEventListener((state: { isConnected: boolean | null; isInternetReachable: boolean | null }) => {
      // Treat "unknown" (null) reachability as online; only an explicit false or
      // a disconnected interface counts as offline. Avoids false-offline flaps.
      const online = state.isConnected !== false && state.isInternetReachable !== false;
      setOnline(online);
    });
  } catch {
    /* NetInfo unavailable — traffic signals + AppState re-check still work. */
  }

  AppState.addEventListener('change', (status: AppStateStatus) => {
    // Coming back to the app — verify connectivity so a network that recovered
    // while backgrounded refetches immediately.
    if (status === 'active') {
      void isReachable().then((ok) => setOnline(ok));
    }
  });
}
