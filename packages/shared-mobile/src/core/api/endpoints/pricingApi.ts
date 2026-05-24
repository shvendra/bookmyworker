import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';

export interface PricingConfig {
  gstPercentage: number;
  verifiedBadge: {
    agent: number;
    worker: number;
  };
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
  topup: {
    contacts50: number;
    contacts100: number;
  };
}

const DEFAULTS: PricingConfig = {
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

async function fetchPricingConfig(): Promise<PricingConfig> {
  const res = await apiClient.get<{ success: boolean; data: { pricing?: Partial<PricingConfig> } }>('/api/v1/settings/public');
  const remote = res.data.data?.pricing;
  if (!remote) return DEFAULTS;
  return {
    ...DEFAULTS,
    ...remote,
    verifiedBadge: {
      ...DEFAULTS.verifiedBadge,
      ...remote.verifiedBadge,
    },
    subscription: {
      ...DEFAULTS.subscription,
      ...remote.subscription,
      agent: { ...DEFAULTS.subscription.agent, ...remote.subscription?.agent },
    },
    subscriptionMrp: {
      ...DEFAULTS.subscriptionMrp,
      ...remote.subscriptionMrp,
      agent: { ...DEFAULTS.subscriptionMrp.agent, ...remote.subscriptionMrp?.agent },
    },
  };
}

/** Returns the discount percentage (0-100) or null when there is no discount. */
export function calcDiscount(mrp: number, price: number): number | null {
  if (!mrp || mrp <= price) return null;
  return Math.round(((mrp - price) / mrp) * 100);
}

export function usePricingConfig() {
  const query = useQuery({
    queryKey: ['global-pricing-config'],
    queryFn: fetchPricingConfig,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const pricing = query.data ?? DEFAULTS;
  const gstRate = pricing.gstPercentage / 100;

  return { pricing, gstRate, isLoading: query.isLoading };
}
