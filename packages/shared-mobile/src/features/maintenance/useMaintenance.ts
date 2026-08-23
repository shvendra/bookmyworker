import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { fetchMaintenanceStatus, type MaintenanceStatus, type MaintenanceSurface } from './maintenanceApi';

const OFF: MaintenanceStatus = { enabled: false, message: '', eta: '' };
const POLL_MS = 60000;

/**
 * Polls the maintenance status for this app's surface ("agent" | "employer").
 * Re-checks every 60s and whenever the app returns to the foreground, so turning
 * maintenance off reaches users quickly. Fail-safe: errors keep it OFF.
 */
export function useMaintenance(app: MaintenanceSurface): MaintenanceStatus {
  const [status, setStatus] = useState<MaintenanceStatus>(OFF);

  useEffect(() => {
    let alive = true;

    const check = async () => {
      const next = await fetchMaintenanceStatus(app);
      if (alive) setStatus(next);
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

  return status;
}
