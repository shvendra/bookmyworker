import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../api/client';
import { useToast } from '../../shared/state/toast/ToastContext';
import { playQuotaAlert } from '../sound/quotaSound';

/**
 * Contact-quota usage nudges for the worker-search screen.
 *
 * Shows a transient (auto-dismiss) toast as the employer crosses 25 / 50 / 75%
 * of their contact quota, and redirects to the Subscription screen at 100%, so
 * they never get surprised by a hard stop at the end. The worker-search UI is
 * NOT changed — this only emits toasts; nothing is rendered.
 *
 * Design notes:
 *  - "Active quota auto": tracks the gifted free-contacts pool for non-subscribed
 *    users and the paid plan pool for subscribed users (whichever is consuming).
 *  - The paid denominator (plan total) is derived from Settings when the plan's
 *    duration is known, but ALSO self-corrects from the highest remaining value
 *    seen this session — the duration field is not always persisted on the user,
 *    so we never trust it alone.
 *  - Per-session via refs (no storage): on the first complete read it silently
 *    baselines to the current usage, then only fires when the employer crosses a
 *    NEW threshold by actually consuming. This avoids re-showing on every visit
 *    and avoids a bounce-to-pricing on mount when already exhausted.
 *  - Employer-only by construction: agents have no contact quota, so callers pass
 *    `enabled: role === 'Employer'` and the agent app simply never fires.
 */

const THRESHOLDS = [25, 50, 75, 100] as const;
// Below this many remaining contacts, alert on EVERY contact view (not once).
const LAST_N_ALERT = 10;

type EmployerTypeRaw = string | Record<string, boolean> | undefined;
type TypeKey = 'individual' | 'contractor' | 'agency' | 'industry';

function resolveTypeKey(raw: EmployerTypeRaw): TypeKey {
  const keys: TypeKey[] = ['industry', 'agency', 'contractor', 'individual'];
  if (raw && typeof raw === 'object') {
    const match = keys.find((k) => (raw as Record<string, boolean>)[k]);
    if (match) return match;
  }
  const s = String(raw ?? '').toLowerCase();
  return keys.find((k) => s.includes(k)) ?? 'individual';
}

function resolveDuration(subType?: string): '1m' | '6m' | '12m' | null {
  switch (subType) {
    case 'Monthly':     return '1m';
    case 'Half-Yearly': return '6m';
    case 'Yearly':      return '12m';
    default:            return null;
  }
}

interface SettingsShape {
  freeContacts?: number;
  employerPlans?: Record<string, { limits?: Record<string, { contacts?: number }> }>;
}

export interface ContactQuotaInput {
  /** Run the nudge at all — pass `profileLoaded && role === 'Employer'`. */
  enabled: boolean;
  isSubscribed: boolean;
  employerType?: EmployerTypeRaw;
  /** Schema field name carries a historical typo; "Monthly" | "Half-Yearly" | "Yearly". */
  subscriptionTpype?: string;
  remainingContacts: number;
  freeContactsUsed: number;
  freeContactsRemaining: number;
  /** True plan allotment for the current period from getuser (remaining +
   *  charged-this-period). 0/undefined → falls back to Settings/baseline. */
  contactsTotal?: number;
}

export function useContactQuotaNudge(
  input: ContactQuotaInput,
  onExhausted: () => void,
): void {
  const { t } = useTranslation('employer');
  const toast = useToast();

  // Plan limits + gifted free-contacts allotment (SuperAdmin Settings).
  const settingsQuery = useQuery({
    queryKey: ['settings-contact-quota'],
    queryFn: async () => {
      const res = await apiClient.get<{ data?: SettingsShape }>('/api/v1/settings/public');
      return res.data?.data ?? null;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });
  const settingsResolved = settingsQuery.isSuccess || settingsQuery.isError;
  const settings = settingsQuery.data ?? null;

  const initRef = useRef(false);
  const shownRef = useRef(0);
  const lastRemRef = useRef<number | null>(null);
  const baseRef = useRef(0);
  // Keep the latest callback without re-arming the effect every render.
  const onExhaustedRef = useRef(onExhausted);
  onExhaustedRef.current = onExhausted;

  const {
    enabled, isSubscribed, employerType, subscriptionTpype,
    remainingContacts, freeContactsUsed, freeContactsRemaining, contactsTotal,
  } = input;

  useEffect(() => {
    if (!enabled || !settingsResolved) return;

    let total: number;
    let used: number;
    let remaining: number;

    if (isSubscribed) {
      const typeKey = resolveTypeKey(employerType);
      const dur = resolveDuration(subscriptionTpype);
      const settingsTotal = dur
        ? Number(settings?.employerPlans?.[typeKey]?.limits?.[dur]?.contacts ?? 0)
        : 0;
      // Preferred denominator: the TRUE backend allotment; then Settings plan
      // total (when duration is known); then the highest remaining seen.
      baseRef.current = Math.max(
        baseRef.current, Number(contactsTotal ?? 0), settingsTotal, remainingContacts,
      );
      total = baseRef.current;
      remaining = remainingContacts;
      used = Math.max(0, total - remaining);
    } else {
      total = Number(settings?.freeContacts ?? 0);
      used = freeContactsUsed;
      remaining = freeContactsRemaining;
    }

    if (!(total > 0)) return; // no measurable pool → nothing to nudge
    const percent = Math.min(100, Math.max(0, Math.round((used / total) * 100)));

    // First complete read: silently baseline so we don't spam past thresholds.
    if (!initRef.current) {
      shownRef.current = [...THRESHOLDS].filter((x) => percent >= x).pop() ?? 0;
      lastRemRef.current = remaining;
      initRef.current = true;
      return;
    }

    const prevRem = lastRemRef.current;
    // Quota refilled (top-up / renew) → re-arm the milestone nudges.
    if (prevRem != null && remaining > prevRem) shownRef.current = 0;
    // A contact was just viewed this render (remaining dropped).
    const consumed = prevRem != null && remaining < prevRem;
    lastRemRef.current = remaining;

    // Highest newly-crossed milestone (handles big jumps in one step).
    const fired = [...THRESHOLDS].filter((x) => percent >= x && x > shownRef.current).pop();

    // All contacts used → redirect (once).
    if (fired === 100) {
      shownRef.current = 100;
      toast.warning(t('cq_outMsg'), t('cq_outTitle'));
      onExhaustedRef.current();
      return;
    }

    // Last-10 danger zone: alert + vibrate/beep on EVERY contact view (not once).
    if (consumed && remaining >= 1 && remaining <= LAST_N_ALERT) {
      if (fired) shownRef.current = fired; // keep milestone state in sync, avoid double toast
      playQuotaAlert();
      toast.warning(t('cq_last10Msg', { left: remaining }), t('cq_lowTitle'));
      return;
    }

    // Otherwise: one-time milestone nudge (25 / 50 / 75%).
    if (fired) {
      shownRef.current = fired;
      toast.warning(t('cq_lowMsg', { pct: fired, left: remaining }), t('cq_lowTitle'));
    }
  }, [
    enabled, settingsResolved, isSubscribed, employerType, subscriptionTpype,
    remainingContacts, freeContactsUsed, freeContactsRemaining, contactsTotal, settings, t, toast,
  ]);
}
