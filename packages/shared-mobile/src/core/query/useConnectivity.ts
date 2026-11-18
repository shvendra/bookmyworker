import { useEffect, useState } from 'react';
import { beginPaymentGrace, getOnline, getWeak, subscribeOnline, subscribeWeak } from './connectivity';

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

/** True when the device is connected but our server is unreachable (drives the slim "weak connection" banner). */
export function useWeakConnection(): boolean {
  const [weak, setWeak] = useState<boolean>(getWeak());
  useEffect(() => {
    setWeak(getWeak());
    return subscribeWeak(setWeak);
  }, []);
  return weak;
}

/**
 * Call from a payment screen: while it is open (and for a couple of minutes after it closes — the
 * return from a UPI app / gateway) the app never shows the blocking "No internet" screen.
 */
export function usePaymentGrace(): void {
  useEffect(() => {
    beginPaymentGrace();
    return () => beginPaymentGrace();
  }, []);
}
