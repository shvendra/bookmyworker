// Team access is for Industry / Contractor / Agency employers (the server re-checks plan + type on every call).
export const canHaveTeam = (employerType?: string | Record<string, boolean> | null): boolean => {
  if (employerType && typeof employerType === 'object') return !!(employerType.industry || employerType.agency || employerType.contractor);
  const s = String(employerType ?? '').toLowerCase();
  return s.includes('industry') || s.includes('agency') || s.includes('contractor');
};

/** "Find workers" is required for everything else — turning anything on turns it on, and it can't be turned off while others are on. */
export const nextPermissions = (current: string[], key: string): string[] => {
  const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
  return next.length > 0 && !next.includes('workers:search') ? [...next, 'workers:search'] : next;
};
