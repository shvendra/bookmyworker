import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus, Linking } from 'react-native';

export interface CalledWorker {
  id: string;
  name: string;
  phone: string;
}

// A return to the app within this window of tapping "call" is treated as
// "they just finished (or abandoned) the call" → ask if it connected.
const RETURN_WINDOW_MS = 3 * 60 * 1000;
// …but ignore an almost-instant bounce (permission sheet, mis-tap) so we don't
// nag when no call actually happened.
const MIN_AWAY_MS = 1500;

/**
 * Tracks the "user tapped a call button → left the app → came back" flow.
 *
 *   const call = useCallReturn();
 *   <Btn onPress={() => call.dial({ id, name, phone })} />
 *   {call.pending && <CallCheckSheet worker={call.pending} … />}
 *
 * `dial()` opens the system dialer AND arms the return check. When the app next
 * becomes active, `pending` is set to that worker so the screen can ask whether
 * the call connected (→ log outcome) or not (→ offer WhatsApp).
 */
export function useCallReturn() {
  const armed = useRef<{ w: CalledWorker; at: number } | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const [pending, setPending] = useState<CalledWorker | null>(null);

  const dial = useCallback((w: CalledWorker) => {
    if (!w.phone) return;
    armed.current = { w, at: Date.now() };
    void Linking.openURL(`tel:${w.phone}`);
  }, []);

  const dismiss = useCallback(() => {
    armed.current = null;
    setPending(null);
  }, []);

  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      const prev = appState.current;
      appState.current = next;
      const cameToForeground =
        (prev === 'background' || prev === 'inactive') && next === 'active';
      if (!cameToForeground) return;
      const a = armed.current;
      armed.current = null;
      if (a && Date.now() - a.at >= MIN_AWAY_MS && Date.now() - a.at < RETURN_WINDOW_MS) {
        setPending(a.w);
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, []);

  return { pending, dial, dismiss };
}
