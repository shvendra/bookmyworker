import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { workerApi } from '../../../core/api/endpoints/workerApi';
import type { WorkerFilters } from '../components/workerSearchShared';

/**
 * Live "how many workers match these filters" for the filter sheet's apply button. Debounced (so tapping
 * through options does not fire a request each time) and read from the same search API as the list
 * (limit 1 → only the total is used). null while loading / on error, so the button simply keeps its
 * normal label — the count is an extra, never a blocker.
 */
export function useFilterResultCount(f: WorkerFilters, enabled: boolean): number | null {
  const key = JSON.stringify(f);
  const [settled, setSettled] = useState(key);
  useEffect(() => {
    const id = setTimeout(() => setSettled(key), 400);
    return () => clearTimeout(id);
  }, [key]);
  const filters: WorkerFilters = JSON.parse(settled);
  const { data, isFetching } = useQuery({
    queryKey: ['worker-filter-count', settled],
    enabled,
    staleTime: 60 * 1000,
    retry: 0,
    queryFn: async () => (await workerApi.getAllAgents({
      workerType:    filters.workerType    || undefined,
      subCategory:   filters.subCategory   || undefined,
      state:         filters.state         || undefined,
      district:      filters.district      || undefined,
      block:         filters.tehsil        || undefined,
      gender:        filters.gender        || undefined,
      workerGroup:   filters.workerGroup   || undefined,
      qualification: filters.qualification || undefined,
      minAge:        filters.ageMin ? Number(filters.ageMin) : undefined,
      maxAge:        filters.ageMax ? Number(filters.ageMax) : undefined,
      hasResume:     filters.hasResume || undefined,
      page: 1,
      limit: 1,
    })).total,
  });
  // While the user is still changing options (settled lags behind) or refetching, hide the stale number.
  if (settled !== key || isFetching || typeof data !== 'number') return null;
  return data;
}
