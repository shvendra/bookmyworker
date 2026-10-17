import type { TFunction } from 'i18next';
import { navigationRef } from '../../core/navigation/navigationRef';
import { showAlert } from '../../shared/state/alert/AppAlertContext';

/**
 * What stopped the employer from continuing:
 *  - required: never subscribed / no active plan
 *  - expired:  had a plan, it has lapsed
 *  - limit:    plan's worker-profile quota is used up (top-up)
 *  - plan:     the action isn't part of the current plan (upgrade)
 */
export type SubscriptionIssue = 'required' | 'expired' | 'limit' | 'plan';

/**
 * Map an API error to a subscription issue, or null when the error is unrelated
 * (so callers keep their own generic error handling). Prefers the backend's
 * machine-readable `code`; falls back to the message for endpoints that only
 * return a plain 403 (e.g. invite-worker's plan gate).
 */
export function classifySubscriptionError(err: unknown): SubscriptionIssue | null {
  const e = err as { statusCode?: number; code?: string; message?: string; response?: { data?: { code?: string; message?: string } } };
  const code = e?.code ?? e?.response?.data?.code;
  if (code === 'SUBSCRIPTION_EXPIRED') return 'expired';
  if (code === 'SUBSCRIPTION_REQUIRED') return 'required';
  if (code === 'CONTACT_LIMIT') return 'limit';
  const status = e?.statusCode ?? (e as { response?: { status?: number } })?.response?.status;
  const msg = String(e?.message ?? e?.response?.data?.message ?? '').toLowerCase();
  if (status === 403) {
    if (msg.includes('not included in your current plan') || msg.includes('upgrade')) return 'plan';
    if (msg.includes('expired')) return 'expired';
    if (msg.includes('subscri')) return 'required';
  }
  return null;
}

const KEYS: Record<SubscriptionIssue, { title: string; msg: string; btn: string }> = {
  required: { title: 'sub_noneTitle',    msg: 'sub_noneMsg',    btn: 'sub_btnSubscribe' },
  expired:  { title: 'sub_expiredTitle', msg: 'sub_expiredMsg', btn: 'sub_btnRenew' },
  limit:    { title: 'sub_limitTitle',   msg: 'sub_limitMsg',   btn: 'sub_btnTopup' },
  plan:     { title: 'sub_planTitle',    msg: 'sub_planMsg',    btn: 'sub_btnUpgrade' },
};

/** Open the Subscription (payment) screen from anywhere. */
export function goToSubscription(): void {
  if (navigationRef.isReady()) {
    (navigationRef as unknown as { navigate: (name: string) => void }).navigate('Subscription');
  }
}

/**
 * The ONE dialog every gated action shows: a clear message ("you don't have an
 * active subscription" / "expired" / ...) with a Cancel button and a single
 * Subscribe / Renew / Top-up / Upgrade button that takes the user to the payment
 * screen. `t` must be the 'employer' namespace translator.
 */
export function promptSubscription(
  issue: SubscriptionIssue,
  t: TFunction,
  onBeforeNavigate?: () => void,
): void {
  const k = KEYS[issue];
  showAlert(
    t(k.title),
    t(k.msg),
    [
      { text: t('wp_cancel'), style: 'cancel' },
      {
        text: t(k.btn),
        onPress: () => {
          try { onBeforeNavigate?.(); } catch { /* never block navigation */ }
          goToSubscription();
        },
      },
    ],
    { type: 'warning' },
  );
}
