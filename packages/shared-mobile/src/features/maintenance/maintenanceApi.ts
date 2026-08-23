import { API_ORIGIN } from '../../core/config/env';

export type MaintenanceSurface = 'agent' | 'employer' | 'crm' | 'nextweb';

export interface MaintenanceStatus {
  enabled: boolean;
  message: string;
  eta: string;
}

const OFF: MaintenanceStatus = { enabled: false, message: '', eta: '' };

/**
 * Fetch the maintenance status for one surface. Uses a plain fetch (NOT the
 * authed apiClient) so it stays public and does not feed the connectivity/
 * onlineManager machinery.
 *
 * FAIL-SAFE: any error resolves to { enabled:false }. A maintenance check must
 * never take the app down on its own failure.
 */
export async function fetchMaintenanceStatus(app: MaintenanceSurface): Promise<MaintenanceStatus> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(`${API_ORIGIN}/api/v1/maintenance?app=${encodeURIComponent(app)}`, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!res.ok) return OFF;
      const data = await res.json();
      return {
        enabled: data?.enabled === true,
        message: typeof data?.message === 'string' ? data.message : '',
        eta: typeof data?.eta === 'string' ? data.eta : '',
      };
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return OFF;
  }
}
