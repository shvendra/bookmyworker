/** Team access must be fully translated in every app language (no English fallbacks, no broken placeholders, no missing keys). */
import * as fs from 'fs';
import * as path from 'path';
import { employerTranslation as en } from '../../../core/i18n/locales/employer/en';
import { employerTranslation as hi } from '../../../core/i18n/locales/employer/hi';
import { employerTranslation as mr } from '../../../core/i18n/locales/employer/mr';
import { employerTranslation as gu } from '../../../core/i18n/locales/employer/gu';
import { employerTranslation as ta } from '../../../core/i18n/locales/employer/ta';
import { employerTranslation as te } from '../../../core/i18n/locales/employer/te';
import { employerTranslation as kn } from '../../../core/i18n/locales/employer/kn';
import { employerTranslation as ml } from '../../../core/i18n/locales/employer/ml';
import { employerTranslation as bn } from '../../../core/i18n/locales/employer/bn';
import { employerTranslation as or } from '../../../core/i18n/locales/employer/or';
import { employerTranslation as pa } from '../../../core/i18n/locales/employer/pa';
import { TEAM_MODULES, permKey, groupKey } from '../../../features/team/teamEligibility';

const LOCALES: Record<string, Record<string, string>> = { hi, mr, gu, ta, te, kn, ml, bn, or, pa } as never;
const EN = en as unknown as Record<string, string>;
const keys = Object.keys(EN).filter((k) => k.startsWith('team_'));
const ph = (s: string) => (s.match(/\{\{\w+\}\}/g) ?? []).sort().join(',');
const SAME_AS_ENGLISH_OK = new Set(['team_otp_ph', 'team_call_line']); // language-neutral tokens

// Mirrors backend utils/teamAccess.js PERMISSIONS and the activity actions the server logs.
const PERMISSIONS = ['workers:search', 'workers:call', 'workers:status', 'dashboard:view', 'requirements:post', 'requirements:view', 'requirements:manage', 'calendar:view', 'attendance:view', 'attendance:mark', 'analytics:view'];
const GROUPS = ['Workers', 'Dashboard', 'Requirements', 'Calendar', 'Attendance', 'Analytics'];
const ACTIONS = ['login', 'post_requirement', 'update_requirement', 'hire_worker', 'boost_requirement', 'shortlist_worker', 'update_pipeline', 'invite_worker', 'mark_attendance', 'unlock_contact', 'update_status', 'member_added', 'permissions_changed', 'member_removed', 'member_left', 'member_paused', 'member_resumed', 'invite_sent', 'admin_paused', 'admin_resumed', 'admin_removed'];

describe('Team access translations', () => {
  it('has a substantial English source set', () => { expect(keys.length).toBeGreaterThan(150); });

  it('covers every dynamic key the screens build (modules, permissions, groups, activity actions)', () => {
    const need = [
      ...TEAM_MODULES.flatMap((m) => [`team_mod_${m.key}`, `team_mod_${m.key}_desc`]),
      ...PERMISSIONS.flatMap((p) => [`${permKey(p)}_label`, `${permKey(p)}_desc`]),
      ...GROUPS.map(groupKey),
      ...ACTIONS.map((a) => `team_act_${a}`),
    ];
    expect(need.filter((k) => !(k in EN))).toEqual([]);
  });

  it('every team_* key written in the team screens / worker card exists', () => {
    const root = path.resolve(__dirname, '../../..');
    const files = ['features/team/screens/MyTeamScreen.tsx', 'features/team/screens/TeamHomeScreen.tsx', 'features/team/screens/TeamLoginScreen.tsx', 'features/team/screens/TeamInfoScreen.tsx',
      'features/team/screens/TeamRequirementsScreen.tsx', 'features/team/screens/TeamWorkerSearchScreen.tsx', 'features/team/teamEligibility.ts', 'features/search/components/AgentCard.tsx', 'features/search/screens/WorkerSearchScreen.tsx'];
    const used = new Set<string>();
    for (const f of files) for (const m of fs.readFileSync(path.join(root, f), 'utf8').matchAll(/['"`](team_[a-z_]+)['"`]/g)) used.add(m[1]!);
    expect([...used].filter((k) => !(k in EN))).toEqual([]);
  });

  it.each(Object.keys(LOCALES))('%s: every key is present, non-empty and keeps the exact {{placeholders}}', (lang) => {
    const L = LOCALES[lang]!;
    expect(keys.filter((k) => typeof L[k] !== 'string' || !L[k]!.trim())).toEqual([]);
    expect(keys.filter((k) => ph(L[k]!) !== ph(EN[k]!))).toEqual([]);
  });

  it.each(Object.keys(LOCALES))('%s: is actually translated (not a copy of English)', (lang) => {
    const L = LOCALES[lang]!;
    expect(keys.filter((k) => L[k] === EN[k] && !SAME_AS_ENGLISH_OK.has(k))).toEqual([]);
  });
});
