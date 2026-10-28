// Team access is for Industry / Contractor / Agency employers (the server re-checks plan + type on every call).
export const canHaveTeam = (employerType?: string | Record<string, boolean> | null): boolean => {
  if (employerType && typeof employerType === 'object') return !!(employerType.industry || employerType.agency || employerType.contractor);
  const s = String(employerType ?? '').toLowerCase();
  return s.includes('industry') || s.includes('agency') || s.includes('contractor');
};

/** A write permission needs its read permission (mirror of backend utils/teamAccess.js PERMISSION_REQUIRES). */
export const PERMISSION_REQUIRES: Record<string, string[]> = {
  'workers:call': ['workers:search'],
  'workers:status': ['workers:search'],
  'requirements:manage': ['requirements:view'],
  'attendance:mark': ['attendance:view'],
};

/** Toggle one permission: on brings what it needs; off also removes whatever needs it. */
export const nextPermissions = (current: string[], key: string): string[] => {
  if (current.includes(key)) {
    const dependents = Object.entries(PERMISSION_REQUIRES).filter(([, deps]) => deps.includes(key)).map(([k]) => k);
    return current.filter((k) => k !== key && !dependents.includes(k));
  }
  return Array.from(new Set([...current, key, ...(PERMISSION_REQUIRES[key] ?? [])]));
};

/** A read permission that another ticked permission depends on stays locked on. */
export const isRequiredByOther = (current: string[], key: string): boolean =>
  current.some((k) => k !== key && (PERMISSION_REQUIRES[k] ?? []).includes(key));

export const groupPermissions = <T extends { group?: string }>(catalog: T[]): { name: string; items: T[] }[] => {
  const groups: { name: string; items: T[] }[] = [];
  for (const p of catalog) {
    const name = p.group ?? 'Other';
    let g = groups.find((x) => x.name === name);
    if (!g) { g = { name, items: [] }; groups.push(g); }
    g.items.push(p);
  }
  return groups;
};

export type TeamModuleKey = 'dashboard' | 'post' | 'requirements' | 'calendar' | 'workers' | 'attendance' | 'analytics';
/** `label` / `desc` are the English fallbacks; screens show t(`team_mod_<key>`) / t(`team_mod_<key>_desc`). */
export interface TeamModule { key: TeamModuleKey; label: string; desc: string; emoji: string; any: string[] }
/** What a member can open in the app. Same rules as the CRM portal; the server enforces them again on every call. */
export const TEAM_MODULES: TeamModule[] = [
  { key: 'dashboard', label: 'Dashboard', desc: 'Requirement summary', emoji: '📊', any: ['dashboard:view'] },
  { key: 'post', label: 'Post Requirement', desc: 'Post a new worker requirement', emoji: '➕', any: ['requirements:post'] },
  { key: 'requirements', label: 'My Requirements', desc: 'View and manage requirements', emoji: '📋', any: ['requirements:view'] },
  { key: 'calendar', label: 'Requirement Calendar', desc: 'Requirements by date', emoji: '🗓️', any: ['calendar:view'] },
  { key: 'workers', label: 'Find Workers', desc: 'Search and call workers', emoji: '🔎', any: ['workers:search'] },
  { key: 'attendance', label: 'Worker Attendance', desc: 'View and mark attendance', emoji: '✅', any: ['attendance:view'] },
  { key: 'analytics', label: 'Hiring Analytics', desc: 'Hiring funnel and reports', emoji: '📈', any: ['analytics:view'] },
];
export const teamModulesFor = (permissions: string[] = []): TeamModule[] => TEAM_MODULES.filter((m) => m.any.some((p) => permissions.includes(p)));

/** Translation keys for a server permission such as "workers:call" (the server's English text stays as the fallback). */
export const permKey = (key: string): string => `team_perm_${key.replace(/[^a-z]+/gi, '_')}`;
export const groupKey = (name: string): string => `team_group_${name.toLowerCase()}`;

/** Friendly, translated text for a refusal from the team gateway (null when the error is something else). */
export const teamDeniedText = (err: unknown, t: (k: string) => string): string | null => {
  const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
  if (code === 'TEAM_NO_PERMISSION') return t('team_err_no_permission');
  if (code === 'TEAM_NOT_ALLOWED') return t('team_err_not_allowed');
  return null;
};
