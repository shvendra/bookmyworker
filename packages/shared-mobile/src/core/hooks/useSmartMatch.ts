import { useQuery } from '@tanstack/react-query';
import { workerApi } from '../api/endpoints/workerApi';

export interface SmartMatchParams {
  category?: string;
  categories?: string[];
  subCategory?: string;
  state?: string;
  district?: string;
  limit?: number;
  backups?: number;
}

/**
 * AI Smart Match — fetch ranked best-fit workers for the current requirement.
 * Only runs when there's a category/location to match on, so it never fires on
 * an empty search.
 */
export const useSmartMatch = (params: SmartMatchParams, enabled = true) => {
  const hasSignal = !!(params.category || params.categories?.length || params.district || params.state);
  return useQuery({
    queryKey: ['smart-match', params],
    queryFn: () => workerApi.smartMatch(params),
    enabled: enabled && hasSignal,
    staleTime: 5 * 60 * 1000,
  });
};
