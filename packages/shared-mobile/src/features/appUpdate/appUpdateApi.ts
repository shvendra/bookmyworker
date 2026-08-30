import { API_ORIGIN } from '../../core/config/env';

export type AppSurface = 'agent' | 'employer';

export interface AppUpdateConfig {
  /** installed < this → hard, non-dismissible "update required" screen */
  minVersion: string;
  /** installed < this → soft, dismissible "update available" banner */
  latestVersion: string;
  /** Play Store listing to open on "Update" */
  updateUrl: string;
  /** optional extra line for the update screen */
  message: string;
}

const EMPTY: AppUpdateConfig = { minVersion: '', latestVersion: '', updateUrl: '', message: '' };

/**
 * Fetch the version-gate config for this app surface. Plain fetch (NOT the authed
 * apiClient) so it stays public and never feeds the connectivity machinery.
 *
 * FAIL-SAFE: any error / bad shape resolves to all-empty, which the client reads
 * as "gate off". A version check must never take the app down on its own failure.
 */
export async function fetchAppUpdateConfig(app: AppSurface): Promise<AppUpdateConfig> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(
        `${API_ORIGIN}/api/v1/settings/app-version?app=${encodeURIComponent(app)}`,
        { method: 'GET', cache: 'no-store', signal: controller.signal },
      );
      if (!res.ok) return EMPTY;
      const d = (await res.json()) as Record<string, unknown>;
      return {
        minVersion:    typeof d?.minVersion    === 'string' ? d.minVersion    : '',
        latestVersion: typeof d?.latestVersion === 'string' ? d.latestVersion : '',
        updateUrl:     typeof d?.updateUrl     === 'string' ? d.updateUrl     : '',
        message:       typeof d?.message       === 'string' ? d.message       : '',
      };
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return EMPTY;
  }
}
