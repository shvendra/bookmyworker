import { useEffect, useMemo, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { compareVersions } from './compareVersions';
import { fetchAppUpdateConfig, type AppSurface, type AppUpdateConfig } from './appUpdateApi';

export type UpdateStatus = 'ok' | 'optional' | 'required';

export interface AppUpdateState {
  status: UpdateStatus;
  installedVersion: string;
  latestVersion: string;
  updateUrl: string;
  message: string;
}

const POLL_MS = 60000;

const DEFAULT_STORE: Record<AppSurface, string> = {
  agent: 'https://play.google.com/store/apps/details?id=com.app.myworker',
  employer: 'https://play.google.com/store/apps/details?id=com.bookmyworkers.employer',
};

const EMPTY_CFG: AppUpdateConfig = { minVersion: '', latestVersion: '', updateUrl: '', message: '' };

/** The versionName the OS reports for THIS install (e.g. "1.0.45"). */
function readInstalledVersion(): string {
  return (
    Application.nativeApplicationVersion ||
    (Constants.expoConfig?.version as string | undefined) ||
    ''
  );
}

/**
 * Compares the installed app version against the SuperAdmin-controlled gate
 * (Settings.mobileApp.<surface>) and reports whether the user must / should
 * update. Re-checks every 60s and whenever the app returns to the foreground.
 *
 * Fail-safe everywhere: no config, no resolvable installed version, or any fetch
 * error all resolve to `status: 'ok'` — the gate never blocks the app on its
 * own failure.
 */
export function useAppUpdate(app: AppSurface): AppUpdateState {
  const installed = useMemo(readInstalledVersion, []);
  const [cfg, setCfg] = useState<AppUpdateConfig>(EMPTY_CFG);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      const next = await fetchAppUpdateConfig(app);
      if (alive) setCfg(next);
    };
    check();
    const id = setInterval(check, POLL_MS);
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active') check();
    });
    return () => {
      alive = false;
      clearInterval(id);
      sub.remove();
    };
  }, [app]);

  return useMemo<AppUpdateState>(() => {
    const updateUrl = cfg.updateUrl || DEFAULT_STORE[app];
    if (!installed) {
      return { status: 'ok', installedVersion: '', latestVersion: cfg.latestVersion, updateUrl, message: cfg.message };
    }
    let status: UpdateStatus = 'ok';
    if (cfg.minVersion && compareVersions(installed, cfg.minVersion) < 0) {
      status = 'required';
    } else if (cfg.latestVersion && compareVersions(installed, cfg.latestVersion) < 0) {
      status = 'optional';
    }
    return { status, installedVersion: installed, latestVersion: cfg.latestVersion, updateUrl, message: cfg.message };
  }, [cfg, installed, app]);
}
