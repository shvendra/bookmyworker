import { parseTeamSlug, routeForTeam, setTeamMode, isTeamMode } from '../../../core/team/teamMode';
import { canHaveTeam, nextPermissions, isRequiredByOther, teamModulesFor, groupPermissions } from '../../../features/team/teamEligibility';

describe('team mode routing', () => {
  it('sends employer user/notification calls through the team gateway', () => {
    expect(routeForTeam('/api/v1/user/getAllAgents?page=1')).toEqual({ kind: 'gateway', url: '/api/v1/team-access/api/user/getAllAgents?page=1' });
    expect(routeForTeam('/api/v1/user/unlock-number/abc')).toEqual({ kind: 'gateway', url: '/api/v1/team-access/api/user/unlock-number/abc' });
    expect(routeForTeam('/api/v1/notifications/call-outcome').kind).toBe('gateway');
    expect(routeForTeam('https://www.bookmyworkers.com/api/v1/user/getuser')).toEqual({ kind: 'gateway', url: 'https://www.bookmyworkers.com/api/v1/team-access/api/user/getuser' });
  });
  it('routes the module endpoints (requirements, attendance, pipeline, dashboard…) through the gateway too — including a router root with a query', () => {
    for (const r of ['application', 'attendance', 'mapping', 'employer', 'mobile', 'project-media']) {
      expect(routeForTeam(`/api/v1/${r}/x/y`)).toEqual({ kind: 'gateway', url: `/api/v1/team-access/api/${r}/x/y` });
    }
    expect(routeForTeam('/api/v1/application?limit=50')).toEqual({ kind: 'gateway', url: '/api/v1/team-access/api/application?limit=50' });
  });
  it('lets only the public boot endpoints go out as they are', () => {
    for (const u of ['/api/v1/settings/public', '/api/v1/settings/app-version?app=employer', '/api/v1/maintenance?app=employer', '/api/v1/team-access/login']) {
      expect(routeForTeam(u).kind).toBe('passthrough');
    }
  });
  it('blocks everything else locally (payments, requirements, employer, admin, settings writes…)', () => {
    for (const u of ['/api/v1/payment/create', '/api/v1/job/post', '/api/v1/employer-team/members', '/api/v1/activity/my', '/api/v1/chat/x', '/api/v1/admin/users', '/api/v1/settings/pricing', '/api/v1/employer-team', '/api/v1/chat/rooms', '/somewhere/else']) {
      expect(routeForTeam(u).kind).toBe('blocked');
    }
  });
  it('is off by default and toggles', () => {
    expect(isTeamMode()).toBe(false);
    setTeamMode(true); expect(isTeamMode()).toBe(true);
    setTeamMode(false);
  });
});

describe('team link parsing', () => {
  it('takes a pasted link, a bare code, or a link with a query / extra text', () => {
    expect(parseTeamSlug('https://www.bookmyworkers.com/app/team/acme-labour-4k2p')).toBe('acme-labour-4k2p');
    expect(parseTeamSlug('  ACME-Labour-4K2P  ')).toBe('acme-labour-4k2p');
    expect(parseTeamSlug('Join us: https://x.com/app/team/acme-4k2p?utm=1 thanks')).toBe('acme-4k2p');
  });
  it('rejects things that cannot be a team code', () => {
    for (const bad of ['', '  ', 'ab', '../../etc/passwd', 'https://evil.com/', 'a b c d']) expect(parseTeamSlug(bad)).toBe('');
  });
});

describe('who can have a team / permission toggling', () => {
  it('Industry, Contractor and Agency only', () => {
    expect(canHaveTeam({ industry: true })).toBe(true);
    expect(canHaveTeam({ contractor: true })).toBe(true);
    expect(canHaveTeam({ agency: true })).toBe(true);
    expect(canHaveTeam({ individual: true })).toBe(false);
    expect(canHaveTeam('Industry')).toBe(true);
    expect(canHaveTeam(undefined)).toBe(false);
    expect(canHaveTeam({})).toBe(false);
  });
  it('anything beyond "find workers" brings "find workers" with it, and it cannot be dropped while others are on', () => {
    expect(nextPermissions([], 'workers:call')).toEqual(['workers:call', 'workers:search']);
    expect(nextPermissions(['workers:search', 'workers:call'], 'workers:call')).toEqual(['workers:search']);
    expect(nextPermissions(['workers:search'], 'workers:search')).toEqual([]);
    expect(nextPermissions(['workers:search', 'workers:status'], 'workers:search')).toEqual([]); // turning the read off turns the write off
  });
  it('module permissions: write brings read; read stays locked while the write is on', () => {
    expect(nextPermissions([], 'attendance:mark').sort()).toEqual(['attendance:mark', 'attendance:view']);
    expect(nextPermissions([], 'requirements:manage').sort()).toEqual(['requirements:manage', 'requirements:view']);
    expect(nextPermissions([], 'requirements:post')).toEqual(['requirements:post']);
    expect(isRequiredByOther(['attendance:view', 'attendance:mark'], 'attendance:view')).toBe(true);
    expect(isRequiredByOther(['attendance:view'], 'attendance:view')).toBe(false);
  });
  it('a member sees only the modules their permissions open', () => {
    expect(teamModulesFor(['workers:search']).map((m) => m.key)).toEqual(['workers']);
    expect(teamModulesFor(['dashboard:view', 'requirements:post', 'attendance:view', 'attendance:mark']).map((m) => m.key)).toEqual(['dashboard', 'post', 'attendance']);
    expect(teamModulesFor([])).toEqual([]);
    expect(teamModulesFor(undefined)).toEqual([]);
  });
  it('groups the permission catalogue in order', () => {
    expect(groupPermissions([{ group: 'A' }, { group: 'B' }, { group: 'A' }]).map((g) => [g.name, g.items.length])).toEqual([['A', 2], ['B', 1]]);
  });
});

import { isTeamIdentifier } from '../../../core/team/teamMode';
describe('isTeamIdentifier (mobile number or email)', () => {
  it('accepts a valid mobile number or email', () => {
    for (const v of ['9876543210', '98765 43210', 'ravi@acme.com', ' Ravi.K@acme.co.in ']) expect(isTeamIdentifier(v)).toBe(true);
  });
  it('rejects half-typed or invalid ids', () => {
    for (const v of ['', '12345', '5876543210', 'ravi@', 'ravi@acme', '@acme.com', 'a b@acme.com']) expect(isTeamIdentifier(v)).toBe(false);
  });
});
