import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';

// ─── Pricing ───────────────────────────────────────────────────────────────────
export interface PricingConfig {
  gstPercentage: number;
  verifiedBadge: { agent: number; worker: number };
  subscription: {
    individual: { '1m': number; '6m': number; '12m': number };
    contractor:  { '1m': number; '6m': number; '12m': number };
    agency:      { '1m': number; '6m': number; '12m': number };
    industry:    { '1m': number; '6m': number; '12m': number };
    agent:       { '1m': number; '6m': number; '12m': number };
  };
  // Original (MRP/strikethrough) prices — display only, never used in payment logic
  subscriptionMrp: {
    individual: { '1m': number; '6m': number; '12m': number };
    contractor:  { '1m': number; '6m': number; '12m': number };
    agency:      { '1m': number; '6m': number; '12m': number };
    industry:    { '1m': number; '6m': number; '12m': number };
    agent:       { '1m': number; '6m': number; '12m': number };
  };
  topup: { contacts50: number; contacts100: number };
}

// ─── Employer Plans ────────────────────────────────────────────────────────────
export type EmployerTypeKey   = 'individual' | 'contractor' | 'agency' | 'industry';
export type WorkerSearchScope = 'district'   | 'state'      | 'india';

/** Contact-unlock & post limits for one plan duration */
export interface PlanLimits {
  contacts: number;
  posts: number;    // 999 = unlimited (unlimitedPosts feature)
}

/** Feature flags granted by a plan type — same for all 3 durations of that type */
export interface PlanFeatures {
  workerSearchScope: WorkerSearchScope;
  pipelineEnabled:   boolean;
  inviteEnabled:     boolean;
  analyticsEnabled:  boolean;
  analyticsMonths:   number;
  priorityListing:   boolean;
  unlimitedPosts:    boolean;
  bulkPostEnabled:   boolean;
  dedicatedSupport:  boolean;
}

export interface EmployerPlanConfig {
  limits:   { '1m': PlanLimits; '6m': PlanLimits; '12m': PlanLimits };
  features: PlanFeatures;
}

export interface EmployerPlansConfig {
  individual: EmployerPlanConfig;
  contractor:  EmployerPlanConfig;
  agency:      EmployerPlanConfig;
  industry:    EmployerPlanConfig;
}

// ─── Defaults (mirror Settings.js schema defaults) ────────────────────────────
const PRICING_DEFAULTS: PricingConfig = {
  gstPercentage: 18,
  verifiedBadge: { agent: 999, worker: 49 },
  subscription: {
    individual: { '1m': 199,  '6m': 999,  '12m': 1999 },
    contractor:  { '1m': 599,  '6m': 2900, '12m': 4999 },
    agency:      { '1m': 599,  '6m': 2900, '12m': 4999 },
    industry:    { '1m': 999,  '6m': 3999, '12m': 5999 },
    agent:       { '1m': 299,  '6m': 1499, '12m': 2499 },
  },
  subscriptionMrp: {
    individual: { '1m': 498,  '6m': 1998,  '12m': 2999 },
    contractor:  { '1m': 1499, '6m': 5800,  '12m': 9999 },
    agency:      { '1m': 1499, '6m': 5800,  '12m': 9999 },
    industry:    { '1m': 2499, '6m': 7999,  '12m': 11999 },
    agent:       { '1m': 599,  '6m': 2999,  '12m': 4999 },
  },
  topup: { contacts50: 199, contacts100: 349 },
};

export const EMPLOYER_PLANS_DEFAULTS: EmployerPlansConfig = {
  individual: {
    limits: {
      '1m':  { contacts: 50,   posts: 10  },
      '6m':  { contacts: 250,  posts: 25  },
      '12m': { contacts: 500,  posts: 50  },
    },
    features: {
      workerSearchScope: 'district', pipelineEnabled: false, inviteEnabled: false,
      analyticsEnabled: true,  analyticsMonths: 3,
      priorityListing: false,  unlimitedPosts: false,
      bulkPostEnabled: false,  dedicatedSupport: false,
    },
  },
  contractor: {
    limits: {
      '1m':  { contacts: 150,  posts: 40  },
      '6m':  { contacts: 700,  posts: 80  },
      '12m': { contacts: 1500, posts: 150 },
    },
    features: {
      workerSearchScope: 'state', pipelineEnabled: true, inviteEnabled: true,
      analyticsEnabled: true,  analyticsMonths: 12,
      priorityListing: false,  unlimitedPosts: false,
      bulkPostEnabled: true,   dedicatedSupport: false,
    },
  },
  agency: {
    limits: {
      '1m':  { contacts: 200,  posts: 30  },
      '6m':  { contacts: 1000, posts: 60  },
      '12m': { contacts: 2000, posts: 100 },
    },
    features: {
      workerSearchScope: 'state', pipelineEnabled: true, inviteEnabled: true,
      analyticsEnabled: true,  analyticsMonths: 12,
      priorityListing: false,  unlimitedPosts: false,
      bulkPostEnabled: false,  dedicatedSupport: false,
    },
  },
  industry: {
    limits: {
      '1m':  { contacts: 400,  posts: 999 },
      '6m':  { contacts: 2000, posts: 999 },
      '12m': { contacts: 4000, posts: 999 },
    },
    features: {
      workerSearchScope: 'india', pipelineEnabled: true, inviteEnabled: true,
      analyticsEnabled: true,  analyticsMonths: 12,
      priorityListing: true,   unlimitedPosts: true,
      bulkPostEnabled: true,   dedicatedSupport: true,
    },
  },
};

// ─── Merge helpers ─────────────────────────────────────────────────────────────
function mergePricing(remote?: Partial<PricingConfig>): PricingConfig {
  if (!remote) return PRICING_DEFAULTS;
  return {
    ...PRICING_DEFAULTS,
    ...remote,
    verifiedBadge: { ...PRICING_DEFAULTS.verifiedBadge, ...remote.verifiedBadge },
    subscription: {
      ...PRICING_DEFAULTS.subscription,
      ...remote.subscription,
      agent: { ...PRICING_DEFAULTS.subscription.agent, ...remote.subscription?.agent },
    },
    subscriptionMrp: {
      ...PRICING_DEFAULTS.subscriptionMrp,
      ...remote.subscriptionMrp,
      agent: { ...PRICING_DEFAULTS.subscriptionMrp.agent, ...remote.subscriptionMrp?.agent },
    },
  };
}

function mergeEmployerPlans(remote?: Partial<EmployerPlansConfig>): EmployerPlansConfig {
  if (!remote) return EMPLOYER_PLANS_DEFAULTS;
  const keys: EmployerTypeKey[] = ['individual', 'contractor', 'agency', 'industry'];
  const merged: EmployerPlansConfig = { ...EMPLOYER_PLANS_DEFAULTS };
  for (const key of keys) {
    const def = EMPLOYER_PLANS_DEFAULTS[key];
    const rem = (remote as Record<string, Partial<EmployerPlanConfig>>)[key];
    if (!rem) continue;
    merged[key] = {
      limits: {
        '1m':  { ...def.limits['1m'],  ...(rem.limits?.['1m']  ?? {}) },
        '6m':  { ...def.limits['6m'],  ...(rem.limits?.['6m']  ?? {}) },
        '12m': { ...def.limits['12m'], ...(rem.limits?.['12m'] ?? {}) },
      },
      features: { ...def.features, ...(rem.features ?? {}) },
    };
  }
  return merged;
}

// ─── Public helpers ────────────────────────────────────────────────────────────
/**
 * Convert a PlanFeatures object into human-readable benefit strings.
 * Each line appears ONLY when the corresponding toggle is ON in the SuperAdmin
 * Employer Plans panel — matches the CRM PricingPage logic exactly.
 * workerSearchScope only adds a line for state/india (district = minimum default).
 */
export function buildFeatureBenefits(features: PlanFeatures): string[] {
  const items: string[] = [];
  if (features.workerSearchScope === 'state') items.push('Search workers state-wide — not limited to your district');
  if (features.workerSearchScope === 'india') items.push('Search workers across all of India — no location cap');
  if (features.pipelineEnabled)  items.push('Full hiring pipeline — Shortlist → Interview → Join');
  if (features.inviteEnabled)    items.push('Directly invite workers to apply for your jobs');
  if (features.analyticsEnabled) items.push(`Hiring analytics dashboard (${features.analyticsMonths}-month history)`);
  if (features.priorityListing)  items.push('Priority listing — your requirements shown first to workers');
  if (features.unlimitedPosts)   items.push('Unlimited job requirement posts — no daily cap');
  if (features.bulkPostEnabled)  items.push('Bulk post multiple requirements at once');
  if (features.dedicatedSupport) items.push('Dedicated BookMyWorker account manager assigned');
  return items;
}

/** Returns the discount percentage (0–100) or null when there is no discount. */
export function calcDiscount(mrp: number, price: number): number | null {
  if (!mrp || mrp <= price) return null;
  return Math.round(((mrp - price) / mrp) * 100);
}

// ─── Fetch & React hook ────────────────────────────────────────────────────────
interface SettingsData {
  pricing?:       Partial<PricingConfig>;
  employerPlans?: Partial<EmployerPlansConfig>;
}

interface FetchedConfig {
  pricing:       PricingConfig;
  employerPlans: EmployerPlansConfig;
}

async function fetchConfig(): Promise<FetchedConfig> {
  const res = await apiClient.get<{ success: boolean; data: SettingsData }>('/api/v1/settings/public');
  const data = res.data.data ?? {};
  return {
    pricing:       mergePricing(data.pricing),
    employerPlans: mergeEmployerPlans(data.employerPlans),
  };
}

export function usePricingConfig() {
  const query = useQuery({
    queryKey: ['global-pricing-config'],
    queryFn:  fetchConfig,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const data    = query.data ?? { pricing: PRICING_DEFAULTS, employerPlans: EMPLOYER_PLANS_DEFAULTS };
  const gstRate = data.pricing.gstPercentage / 100;

  return {
    pricing:       data.pricing,
    employerPlans: data.employerPlans,
    gstRate,
    isLoading: query.isLoading,
  };
}
