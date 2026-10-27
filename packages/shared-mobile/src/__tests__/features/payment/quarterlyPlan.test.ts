import { EMPLOYER_PLANS_DEFAULTS, BOOST_DEFAULTS } from '../../../core/api/endpoints/pricingApi';
import { maxDiscountPct } from '../../../features/employer/utils/planExpiredOffer';
import { employerTranslation as en } from '../../../core/i18n/locales/employer/en';
import { employerTranslation as hi } from '../../../core/i18n/locales/employer/hi';
import { employerTranslation as bn } from '../../../core/i18n/locales/employer/bn';
import { employerTranslation as gu } from '../../../core/i18n/locales/employer/gu';
import { employerTranslation as kn } from '../../../core/i18n/locales/employer/kn';
import { employerTranslation as ml } from '../../../core/i18n/locales/employer/ml';
import { employerTranslation as mr } from '../../../core/i18n/locales/employer/mr';
import { employerTranslation as or } from '../../../core/i18n/locales/employer/or';
import { employerTranslation as pa } from '../../../core/i18n/locales/employer/pa';
import { employerTranslation as ta } from '../../../core/i18n/locales/employer/ta';
import { employerTranslation as te } from '../../../core/i18n/locales/employer/te';

describe('3-month (Quarterly) plan — employer app', () => {
  it('every employer type has built-in 3m limits and boosts between the 1m and 6m plans', () => {
    for (const t of ['individual', 'contractor', 'agency', 'industry'] as const) {
      const l = EMPLOYER_PLANS_DEFAULTS[t].limits;
      expect(l['3m'].contacts).toBeGreaterThan(l['1m'].contacts);
      expect(l['3m'].contacts).toBeLessThan(l['6m'].contacts);
      expect(BOOST_DEFAULTS.allowance[t]['3m']).toBeGreaterThan(BOOST_DEFAULTS.allowance[t]['1m']);
      expect(BOOST_DEFAULTS.allowance[t]['3m']).toBeLessThan(BOOST_DEFAULTS.allowance[t]['6m']);
    }
  });

  it('the plan-expired "% off" banner now also looks at the 3m plan', () => {
    const pricing = {
      subscription:    { industry: { '1m': 1499, '3m': 2000, '6m': 4799, '12m': 7999 } },
      subscriptionMrp: { industry: { '1m': 1499, '3m': 4000, '6m': 4999, '12m': 11999 } },
    } as never;
    expect(maxDiscountPct({ industry: true }, pricing)).toBe(50);     // 3m: 2000 vs 4000
  });

  it('all 11 languages have the Quarterly plan name and "3 Months Access" label', () => {
    for (const [name, loc] of Object.entries({ en, hi, bn, gu, kn, ml, mr, or, pa, ta, te })) {
      const dict = loc as unknown as Record<string, string>;
      expect(typeof dict.pricingPlanQuarterly).toBe('string');
      expect(dict.pricingPlanQuarterly.length).toBeGreaterThan(2);
      expect(typeof dict.pricing3MonthAccess).toBe('string');
      expect(`${name}:${dict.pricing3MonthAccess}`).toMatch(/[3३৩]/);
    }
    expect(en.pricingPlanQuarterly).toBe('Quarterly Plan');
  });
});
