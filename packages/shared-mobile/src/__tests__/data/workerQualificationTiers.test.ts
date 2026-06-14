/**
 * Guards the single source of truth for job-seeker qualification tiers, used by
 * RegisterScreen, EditProfileScreen and ProfileCompletionModal. Prevents the
 * three screens from drifting out of sync again, and keeps the tier values aligned
 * with the backend userSchema.workerSubType enum + the Support Staff mapping.
 */
import { WORKER_QUALIFICATION_TIERS, WORKER_TIER_COLOR } from '../../shared/data/workerQualificationTiers';
import { DIPLOMA_GRADUATE_SUBTYPE } from '../../shared/data/supportStaffCategories';
import { translation as en } from '../../core/i18n/locales/en';
import { translation as hi } from '../../core/i18n/locales/hi';
import { translation as ta } from '../../core/i18n/locales/ta';

const VALUES = WORKER_QUALIFICATION_TIERS.map((t) => t.value);
// Must stay a subset of the backend userSchema.workerSubType enum.
const BACKEND_ENUM = ['Skilled', 'Unskilled', 'ITI/Diploma', 'Graduate', '10th/12th/ITI', 'Diploma/Graduate'];

describe('WORKER_QUALIFICATION_TIERS', () => {
  it('has the 4 expected tiers, values unique', () => {
    expect(VALUES).toEqual(['Skilled', 'Unskilled', '10th/12th/ITI', 'Diploma/Graduate']);
    expect(new Set(VALUES).size).toBe(4);
  });

  it('every tier value is accepted by the backend workerSubType enum', () => {
    for (const v of VALUES) expect(BACKEND_ENUM).toContain(v);
  });

  it('includes the Support-Staff-mapped Diploma/Graduate tier', () => {
    expect(VALUES).toContain(DIPLOMA_GRADUATE_SUBTYPE);
  });

  it('every tier has label + description keys present in all sample locales', () => {
    for (const tier of WORKER_QUALIFICATION_TIERS) {
      for (const [code, dict] of [['en', en], ['hi', hi], ['ta', ta]] as const) {
        const d = dict as Record<string, unknown>;
        expect(typeof d[tier.labelKey]).toBe('string');
        expect(`${d[tier.labelKey]}`.trim().length).toBeGreaterThan(0);
        expect(typeof d[tier.descKey]).toBe('string');
        expect(`${d[tier.descKey]}`.trim().length).toBeGreaterThan(0);
        void code;
      }
    }
  });

  it('every tier has an accent colour', () => {
    for (const v of VALUES) expect(WORKER_TIER_COLOR[v]).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});
