import { AppState, type AppStateStatus } from 'react-native';
import { onlineManager } from '@tanstack/react-query';
import { ENV } from '../config/env';

/**
 * React-Native connectivity → React Query onlineManager bridge.
 *
 * React Native has no browser online/offline events, so React Query's onlineManager
 * never learned when the device went offline and back. `refetchOnReconnect` therefore
 * NEVER fired mid-session: if the network dropped while using the app, queries failed
 * and stayed stuck in their error state ("Could not fetch jobs…") even after the
 * network returned. This bridge drives onlineManager from REAL connectivity, with no
 * native dependency:
 *
 *   • the API client reports online (any server response) / offline (network failure)
 *     from actual traffic — see reportNetworkOk / reportNetworkDown,
 *   • while offline, a lightweight reachability probe polls until the network is back,
 *   • returning the app to the foreground re-checks immediately.
 *
 * When connectivity returns, onlineManager flips online → React Query fires a reconnect
 * and refetches the stale/errored queries, so the app recovers on its own.
 */

let currentlyOnline = true;
let recoveryTimer: ReturnType<typeof setTimeout> | null = null;
let installed = false;

const PROBE_TIMEOUT_MS = 5000;
const RECOVERY_POLL_MS = 4000;

// A cheap, unauthenticated reachability probe to the API host. ANY HTTP response
// (even 4xx/5xx) proves the network is back; only a fetch rejection (no response at
// all) means we are still offline.
async function isReachable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    try {
      await fetch(ENV.API_BASE_URL, { method: 'HEAD', signal: controller.signal });
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
}

/** The API client saw a server response → the network is up. */
export function reportNetworkOk(): void {
  setOnline(true);
}

/** The API client hit a network-level failure (no response) → treat as offline. */
export function reportNetworkDown(): void {
  setOnline(false);
}

/**
 * Wire connectivity into React Query. Idempotent — safe to call at module load.
 * Kept side-effect-free until an actual AppState/probe event occurs, so importing it
 * (e.g. from tests) never performs network I/O on its own.
 */
export function installConnectivityManager(): void {
  if (installed) return;
  installed = true;

  AppState.addEventListener('change', (status: AppStateStatus) => {
    // Coming back to the app — verify connectivity so a network that recovered while
    // backgrounded refetches immediately instead of waiting for the next request.
    if (status === 'active') {
      void isReachable().then((ok) => setOnline(ok));
    }
  });
}
