/** Pure helpers behind the dashboard motion components (kept free of React Native so they unit-test cleanly). */

export const easeOutCubic = (t: number): number => {
  const c = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - c, 3);
};

/** Value of a count-up at `elapsed` ms of `duration` ms. Always lands exactly on `to`. */
export const countUpValue = (from: number, to: number, elapsed: number, duration: number): number => {
  if (duration <= 0 || elapsed >= duration) return to;
  return Math.round(from + (to - from) * easeOutCubic(elapsed / duration));
};

/** 670695 → "6,70,695" (Indian digit grouping, same as the rest of the app). */
export const formatIndian = (n: number): string => {
  const v = Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
  return v.toLocaleString('en-IN');
};

export type AgoUnit = 'now' | 'min' | 'hour' | 'day';
export interface AgoParts { unit: AgoUnit; n: number }

/** Coarse "how long ago" for activity events. Future / invalid timestamps read as "just now". */
export const agoParts = (at: string | number | Date | null | undefined, now: number = Date.now()): AgoParts => {
  const ts = at == null ? NaN : new Date(at).getTime();
  if (!Number.isFinite(ts)) return { unit: 'now', n: 0 };
  const mins = Math.floor((now - ts) / 60000);
  if (mins < 1) return { unit: 'now', n: 0 };
  if (mins < 60) return { unit: 'min', n: mins };
  const hours = Math.floor(mins / 60);
  if (hours < 24) return { unit: 'hour', n: hours };
  return { unit: 'day', n: Math.floor(hours / 24) };
};
