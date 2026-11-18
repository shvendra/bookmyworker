import { Dimensions } from 'react-native';
import type { RawRequirement } from '../../../../core/api/endpoints/requirementsApi';

export const NEARBY_SHOW = 14;
export const { width: SCREEN_W } = Dimensions.get('window');
export const REQ_CARD_WIDTH = SCREEN_W - 32; // full-bleed inside 16px padding

// Premium dark palettes for requirement cards — varies by index
// Dark mode — deep/near-black backgrounds
export const REQ_PALETTES_DARK = [
  { bg: '#0A1628', accent: '#4A90FF', accentLight: 'rgba(74,144,255,0.18)' },
  { bg: '#160A30', accent: '#9B59FF', accentLight: 'rgba(155,89,255,0.18)' },
  { bg: '#041E1E', accent: '#00C896', accentLight: 'rgba(0,200,150,0.18)' },
  { bg: '#1A0F00', accent: '#FF9500', accentLight: 'rgba(255,149,0,0.18)'  },
] as const;

// Light mode — medium-dark, rich but not oppressive
export const REQ_PALETTES_LIGHT = [
  { bg: '#2243BC', accent: '#93C5FD', accentLight: 'rgba(147,197,253,0.22)' },
  { bg: '#3B1A72', accent: '#C4B5FD', accentLight: 'rgba(196,181,253,0.22)' },
  { bg: '#0C4040', accent: '#6EE7B7', accentLight: 'rgba(110,231,183,0.22)' },
  { bg: '#7C3000', accent: '#FCD34D', accentLight: 'rgba(252,211,77,0.22)'  },
] as const;

// ─── Pure Utility Helpers ──────────────────────────────────────────────────────

/** Remove underscores and title-case — matches CRM formatLabel pattern */
export const fmtLabel = (s?: string | null): string => {
  if (!s) return '—';
  return s
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

export const fmtDate = (d?: string): string => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
};

export const isClosed = (r: RawRequirement): boolean => {
  const s = String(r.status ?? '').toLowerCase();
  return s === 'closed' || s === 'expired';
};
export const isCompleted = (r: RawRequirement): boolean => {
  const s = String(r.status ?? '').toLowerCase();
  return s === 'completed' || s === 'fulfilled';
};
export const isAssigned = (r: RawRequirement): boolean => !!r.assignedAgentId;
// A requirement is "actively boosted" only while its boostedUntil is in the future.
export const isActivelyBoosted = (r: RawRequirement): boolean =>
  !!(r.isBoosted && r.boostedUntil && new Date(r.boostedUntil).getTime() > Date.now());

export const maskPhone = (id: string): string => {
  const code = id.slice(-2).split('').map((c) => c.charCodeAt(0) % 10).join('');
  return `∗∗∗∗∗∗∗∗${code}`;
};

export const agentStars = (id: string): number => {
  const hash = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return 4.0 + (hash % 10) / 10;
};

export const getGreetingKey = (): 'goodMorning' | 'goodAfternoon' | 'goodEvening' => {
  const h = new Date().getHours();
  if (h < 12) return 'goodMorning';
  if (h < 17) return 'goodAfternoon';
  return 'goodEvening';
};

