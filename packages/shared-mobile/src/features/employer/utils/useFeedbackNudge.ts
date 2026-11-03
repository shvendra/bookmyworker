import { useEffect, useRef } from 'react';
import { selfFeedbackApi } from '../../../core/api/endpoints/selfFeedbackApi';
import { APP_SECONDS_BEFORE_PROMPT } from './feedbackForm';

// The quarterly feedback popup: once the employer has had the dashboard open for a few minutes, ask the server whether they are due
// (active plan, 14+ days old, not answered in the last 90 days, not snoozed) and open the form. At most one check per app launch.
let askedThisLaunch = false;
export const resetFeedbackNudgeForTests = (): void => { askedThisLaunch = false; };

/** Wait, then check once. Returns a cancel function (used when the dashboard goes away or the plan lapses). */
export function scheduleFeedbackNudge(open: () => void, waitSeconds: number = APP_SECONDS_BEFORE_PROMPT): () => void {
  if (askedThisLaunch) return () => undefined;
  const timer = setTimeout(() => {
    if (askedThisLaunch) return;
    askedThisLaunch = true;
    selfFeedbackApi.status().then((s) => { if (s.due) open(); }).catch(() => { /* never bother the employer over a failed check */ });
  }, waitSeconds * 1000);
  return () => clearTimeout(timer);
}

export function useFeedbackNudge(enabled: boolean, open: () => void, waitSeconds: number = APP_SECONDS_BEFORE_PROMPT): void {
  // The caller passes a fresh closure every render; keep the latest one in a ref so re-renders never restart the timer.
  const openRef = useRef(open);
  openRef.current = open;
  useEffect(() => {
    if (!enabled) return undefined;
    return scheduleFeedbackNudge(() => openRef.current(), waitSeconds);
  }, [enabled, waitSeconds]);
}
