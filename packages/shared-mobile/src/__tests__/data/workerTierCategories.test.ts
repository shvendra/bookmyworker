/**
 * Worker qualification-tier → work-category mapping (RegisterScreen).
 *
 * Diploma/Graduate workers pick from the Support Staff taxonomy; every other tier
 * (Skilled / Unskilled / 10th-12th-ITI) picks from the regular worker categories,
 * with support-staff + legacy categories excluded. Pure-function tests, no RN.
 */
import categoriesData from '../../shared/data/categories.json';
import {
  categoryValuesForWorkerTier,
  DIPLOMA_GRADUATE_SUBTYPE,
  SUPPORT_STAFF_CATEGORY_VALUES,
  LEGACY_SUPPORT_STAFF_VALUES,
} from '../../shared/data/supportStaffCategories';

const ALL_VALUES = (categoriesData as Array<{ value: string }>).map((c) => c.value);
const NON_DIPLOMA_TIERS = ['Skilled', 'Unskilled', '10th/12th/ITI', ''];

describe('categoryValuesForWorkerTier', () => {
  it('Diploma/Graduate → exactly the Support Staff categories (order preserved)', () => {
    const result = categoryValuesForWorkerTier(DIPLOMA_GRADUATE_SUBTYPE, ALL_VALUES);
    expect(result).toEqual(ALL_VALUES.filter((v) => SUPPORT_STAFF_CATEGORY_VALUES.includes(v as never)));
    expect(new Set(result)).toEqual(new Set(SUPPORT_STAFF_CATEGORY_VALUES));
  });

  it('Diploma/Graduate never includes legacy or regular worker categories', () => {
    const result = categoryValuesForWorkerTier(DIPLOMA_GRADUATE_SUBTYPE, ALL_VALUES);
    for (const legacy of LEGACY_SUPPORT_STAFF_VALUES) expect(result).not.toContain(legacy);
    expect(result).not.toContain('construction_project_workers');
  });

  it.each(NON_DIPLOMA_TIERS)('tier "%s" → regular worker categories only (no support, no legacy)', (tier) => {
    const result = categoryValuesForWorkerTier(tier, ALL_VALUES);
    for (const v of SUPPORT_STAFF_CATEGORY_VALUES) expect(result).not.toContain(v);
    for (const v of LEGACY_SUPPORT_STAFF_VALUES) expect(result).not.toContain(v);
    // a representative blue-collar category must still be offered
    expect(result).toContain('construction_project_workers');
  });

  it('the two tier sets are disjoint and cover no hidden category twice', () => {
    const dipl = new Set(categoryValuesForWorkerTier(DIPLOMA_GRADUATE_SUBTYPE, ALL_VALUES));
    const reg = new Set(categoryValuesForWorkerTier('Skilled', ALL_VALUES));
    for (const v of dipl) expect(reg.has(v)).toBe(false);
  });

  it('DIPLOMA_GRADUATE_SUBTYPE matches the value stored on the worker profile', () => {
    // guards alignment with the RegisterScreen box value + backend enum
    expect(DIPLOMA_GRADUATE_SUBTYPE).toBe('Diploma/Graduate');
  });
});
