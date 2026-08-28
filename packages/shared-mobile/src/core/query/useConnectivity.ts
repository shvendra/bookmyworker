import { useEffect, useState } from 'react';
import { getOnline, subscribeOnline } from './connectivity';

/**
 * React hook exposing live connectivity. Drives the full-screen offline overlay.
 * Seeds from getOnline() so the first render is already correct.
 */
export function useConnectivity(): boolean {
  const [online, setOnlineState] = useState<boolean>(getOnline());

  useEffect(() => {
    setOnlineState(getOnline());
    return subscribeOnline(setOnlineState);
  }, []);

  return online;
}
