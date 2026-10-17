import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';

export interface LivePulseEvent {
  type: 'worker' | 'requirement';
  /** Category value (e.g. "construction_project_workers") — localise with getWorkTypeLabel. */
  category: string;
  /** English fallback label from the server. */
  categoryLabel: string;
  place: string;
  at: string;
}

export interface LivePulse {
  scope: 'district' | 'state' | 'india';
  place: string;
  activeToday: number;
  newToday: number;
  requirementsToday: number;
  events: LivePulseEvent[];
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** Defensive normaliser — a malformed payload must never break the dashboard. */
export function normalizeLivePulse(raw: unknown): LivePulse | null {
  const d = (raw as { data?: Record<string, unknown> } | null | undefined)?.data;
  if (!d || typeof d !== 'object') return null;
  const events = (Array.isArray(d.events) ? d.events : [])
    .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
    .map((e) => ({
      type: (e.type === 'requirement' ? 'requirement' : 'worker') as LivePulseEvent['type'],
      category: str(e.category),
      categoryLabel: str(e.categoryLabel),
      place: str(e.place),
      at: str(e.at),
    }))
    .filter((e) => !!e.place && !!e.at);
  return {
    scope: d.scope === 'district' || d.scope === 'state' ? d.scope : 'india',
    place: str(d.place) || 'India',
    activeToday: num(d.activeToday),
    newToday: num(d.newToday),
    requirementsToday: num(d.requirementsToday),
    events,
  };
}

/** Anonymised marketplace activity for the employer dashboard. Refreshes quietly every 2 minutes. */
export function useLivePulse(enabled = true) {
  return useQuery({
    queryKey: ['employer-live-pulse'],
    queryFn: async () => normalizeLivePulse((await apiClient.get('/api/v1/employer/live-pulse')).data),
    enabled,
    staleTime: 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
    retry: 1,
  });
}
