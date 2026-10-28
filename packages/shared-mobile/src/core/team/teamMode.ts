// Employer Team Access — "team mode" is on while the app is signed in as a team member (not as the employer).
// In that mode the ordinary employer API calls are re-routed through the backend's team gateway, which applies the member's
// permissions and runs them as the owning employer. See backend/utils/teamAccess.js.
let active = false;

export const setTeamMode = (value: boolean): void => { active = value; };
export const isTeamMode = (): boolean => active;

/** Routers the team gateway re-mounts (must match backend routes/teamAccessRoutes.js). */
const GATEWAY_ROUTERS = ['user', 'notifications'];

/** Public endpoints the app reads on every boot (maintenance / update gate, public settings): safe without any login. */
const PASSTHROUGH = [/^\/api\/v1\/settings\/public/, /^\/api\/v1\/settings\/app-version/, /^\/api\/v1\/maintenance(\/|\?|$)/, /^\/api\/v1\/team-access\//];

export type TeamRoute =
  | { kind: 'gateway'; url: string }
  | { kind: 'passthrough'; url: string }
  | { kind: 'blocked'; url: string };

/** Decide what a team-mode request does: go through the gateway, go out as-is (public), or be refused locally. */
export const routeForTeam = (url: string): TeamRoute => {
  const path = url.replace(/^https?:\/\/[^/]+/i, '');
  if (PASSTHROUGH.some((re) => re.test(path))) return { kind: 'passthrough', url };
  const m = path.match(/^\/api\/v1\/([^/?]+)(\/.*)?$/);
  if (m && GATEWAY_ROUTERS.includes(m[1])) {
    return { kind: 'gateway', url: url.replace(`/api/v1/${m[1]}`, `/api/v1/team-access/api/${m[1]}`) };
  }
  return { kind: 'blocked', url };
};

/** Pull the company slug out of a pasted team link (…/app/team/<slug>) or a bare code. */
export const parseTeamSlug = (input: string): string => {
  const text = String(input ?? '').trim();
  const m = text.match(/\/team\/([a-z0-9][a-z0-9-]*)/i);
  const slug = (m ? m[1] : text.split(/[\s?#]/)[0]).toLowerCase();
  return /^[a-z0-9][a-z0-9-]{2,80}$/.test(slug) ? slug : '';
};

/** A team login id: a 10-digit Indian mobile number or an email address. */
export const isTeamIdentifier = (v: string): boolean => {
  const t = v.trim();
  if (t.includes('@')) return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t);
  return /^[6-9]\d{9}$/.test(t.replace(/\D/g, ''));
};
