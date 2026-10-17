import type { EmployerTypeKey, PricingConfig } from '../../../core/api/endpoints/pricingApi';

const PRIORITY: EmployerTypeKey[] = ['industry', 'agency', 'contractor', 'individual'];
const PLAN_IDS = ['1m', '6m', '12m'] as const;

/** Highest tier the employer holds — mirrors the CRM (industry > agency > contractor > individual). */
export function highestEmployerType(raw: unknown): EmployerTypeKey {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    for (const k of PRIORITY) if (o[k]) return k;
    return 'individual';
  }
  const s = String(Array.isArray(raw) ? raw[0] ?? '' : raw ?? '').toLowerCase();
  for (const k of PRIORITY) if (s.includes(k)) return k;
  return 'individual';
}

/**
 * The biggest "% off" across the 1m / 6m / 12m plans for this employer's tier (price vs MRP),
 * or null when there is no real discount — exactly the number the CRM's plan-expired dialog shows.
 */
export function maxDiscountPct(
  employerType: unknown,
  pricing: Pick<PricingConfig, 'subscription' | 'subscriptionMrp'> | undefined,
): number | null {
  if (!pricing) return null;
  const tier = highestEmployerType(employerType);
  const price = pricing.subscription?.[tier];
  const mrp = pricing.subscriptionMrp?.[tier];
  if (!price || !mrp) return null;
  let max: number | null = null;
  for (const id of PLAN_IDS) {
    const p = Number(price[id]) || 0;
    const m = Number(mrp[id]) || 0;
    if (p > 0 && m > p) {
      const d = Math.round(((m - p) / m) * 100);
      if (max === null || d > max) max = d;
    }
  }
  return max;
}

/** One popup per expiry: renewing and expiring again later shows it again. */
export const planExpiredKey = (userId: string, expiry?: string): string =>
  `employer_plan_expired_seen_${userId}_${expiry ? new Date(expiry).getTime() : 'x'}`;
