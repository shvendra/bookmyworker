import React, { useState } from 'react';
import { Linking, View } from 'react-native';
import { queryClient } from '../core/query/queryClient';
import { forceOnlineRecheck } from '../core/query/connectivity';
import { useConnectivity } from '../core/query/useConnectivity';
import { useMaintenance } from '../features/maintenance/useMaintenance';
import type { MaintenanceSurface } from '../features/maintenance/maintenanceApi';
import { useAppUpdate } from '../features/appUpdate/useAppUpdate';
import type { AppSurface } from '../features/appUpdate/appUpdateApi';
import { UpdateBanner } from '../features/appUpdate/UpdateBanner';
import { FullScreenNotice } from '../shared/components/feedback/FullScreenNotice';

interface AppGateProps {
  app: MaintenanceSurface; // 'agent' | 'employer'
  children: React.ReactNode;
}

/**
 * Wraps the whole app and shows, in priority order:
 *   1. a blocking "Please update the app" screen when the installed version is
 *      below the SuperAdmin-set minimum (a stale app hitting a changed API is
 *      how "my subscription / posts / saved workers disappeared" happens),
 *   2. a maintenance screen when this surface is under maintenance (and online),
 *   3. a full-screen "No internet" overlay when offline,
 *   4. otherwise the app itself — with a slim "update available" strip on top
 *      when a newer (non-mandatory) version exists.
 *
 * The offline "Try again" calls forceOnlineRecheck() (which optimistically
 * un-pauses React Query) and then refetches — so it can never be a dead no-op,
 * which was the core "reload does nothing" bug.
 */
export const AppGate = ({ app, children }: AppGateProps): React.JSX.Element => {
  const online = useConnectivity();
  const maintenance = useMaintenance(app);
  const update = useAppUpdate(app as AppSurface);
  const [retrying, setRetrying] = useState(false);

  // 1. Mandatory update — non-dismissible. Highest priority: an app too old to
  //    talk to the current API must not pretend to work.
  if (update.status === 'required') {
    return (
      <FullScreenNotice
        emoji="🚀"
        title="Please update the app"
        message={
          update.message?.trim() ||
          "You're on an older version of BookMyWorker. Update to the latest version so your subscription, job posts and saved workers load correctly."
        }
        actionLabel="Update now"
        actionIcon="⬆️"
        onRetry={() => { void Linking.openURL(update.updateUrl); }}
        hint="This opens the Play Store — reopen the app once it has updated."
      />
    );
  }

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

  // Optional update → app runs normally, with a dismissible strip up top.
  if (update.status === 'optional') {
    return (
      <View style={{ flex: 1 }}>
        <UpdateBanner latestVersion={update.latestVersion} updateUrl={update.updateUrl} />
        <View style={{ flex: 1 }}>{children}</View>
      </View>
    );
  }

  return <>{children}</>;
};
