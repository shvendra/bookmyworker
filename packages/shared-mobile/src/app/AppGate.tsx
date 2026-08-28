import React, { useState } from 'react';
import { queryClient } from '../core/query/queryClient';
import { forceOnlineRecheck } from '../core/query/connectivity';
import { useConnectivity } from '../core/query/useConnectivity';
import { useMaintenance } from '../features/maintenance/useMaintenance';
import type { MaintenanceSurface } from '../features/maintenance/maintenanceApi';
import { FullScreenNotice } from '../shared/components/feedback/FullScreenNotice';

interface AppGateProps {
  app: MaintenanceSurface; // 'agent' | 'employer'
  children: React.ReactNode;
}

/**
 * Wraps the whole app and shows, in priority order:
 *   1. a maintenance screen when this surface is under maintenance (and online),
 *   2. a full-screen "No internet" overlay when offline,
 *   3. otherwise the app itself.
 *
 * The offline "Try again" calls forceOnlineRecheck() (which optimistically
 * un-pauses React Query) and then refetches — so it can never be a dead no-op,
 * which was the core "reload does nothing" bug.
 */
export const AppGate = ({ app, children }: AppGateProps): React.JSX.Element => {
  const online = useConnectivity();
  const maintenance = useMaintenance(app);
  const [retrying, setRetrying] = useState(false);

  if (maintenance.enabled && online) {
    return (
      <FullScreenNotice
        emoji="🛠️"
        accent="warning"
        title="Under maintenance"
        message={
          maintenance.message?.trim() ||
          "We're making things better and will be back shortly. Thank you for your patience."
        }
        eta={maintenance.eta}
        hint="This screen updates automatically — the app returns on its own once maintenance ends."
      />
    );
  }

  if (!online) {
    const onRetry = async () => {
      setRetrying(true);
      try {
        const ok = await forceOnlineRecheck();
        if (ok) {
          // Un-paused above; now actively refetch everything that was stuck.
          await queryClient.refetchQueries();
        }
      } finally {
        setRetrying(false);
      }
    };

    return (
      <FullScreenNotice
        emoji="📡"
        title="No internet connection"
        message="Please check your Wi-Fi or mobile data. We'll reconnect and reload automatically the moment you're back online."
        retrying={retrying}
        onRetry={onRetry}
        hint="Waiting for the network…"
      />
    );
  }

  return <>{children}</>;
};
