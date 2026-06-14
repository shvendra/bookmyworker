/**
 * Support-staff taxonomy contract tests.
 *
 * Guards the data contract that the Office_Staff requirement-type picker and the
 * label translation helpers (getWorkTypeLabel / getSubCatLabel) rely on:
 *  - every support-staff category exists in categories.json with subcategories
 *  - every support-staff subcategory carries all 11 language labels
 *  - every support-staff category has a cat_<value> key in ALL 11 locale files
 *  - the legacy Permanent/Contract categories + keys are retained (no regression
 *    for historical requirements)
 *  - support-staff categories never leak into the non-support picker set
 */
import categoriesData from '../../shared/data/categories.json';
import {
  SUPPORT_STAFF_CATEGORY_VALUES,
  LEGACY_SUPPORT_STAFF_VALUES,
  HIDDEN_FROM_NON_SUPPORT,
} from '../../shared/data/supportStaffCategories';
import { translation as en } from '../../core/i18n/locales/en';
import { translation as hi } from '../../core/i18n/locales/hi';
import { translation as mr } from '../../core/i18n/locales/mr';
import { translation as gu } from '../../core/i18n/locales/gu';
import { translation as ta } from '../../core/i18n/locales/ta';
import { translation as te } from '../../core/i18n/locales/te';
import { translation as kn } from '../../core/i18n/locales/kn';
import { translation as ml } from '../../core/i18n/locales/ml';
import { translation as bn } from '../../core/i18n/locales/bn';
import { translation as or } from '../../core/i18n/locales/or';
import { translation as pa } from '../../core/i18n/locales/pa';

interface Sub {
  label: string;
  value: string;
  [k: string]: string | undefined;
}
interface Cat {
  label: string;
  value: string;
  subcategories?: Sub[];
}

const CATS = categoriesData as Cat[];
const byValue = (v: string): Cat | undefined => CATS.find((c) => c.value === v);

// i18n code → embedded subcategory field name in categories.json
const SUBCAT_LANG_FIELDS = [
  'hindilabel', 'marathilabel', 'gujaratilabel', 'tamillabel', 'telugulabel',
  'kannadalabel', 'malayalamlabel', 'banglalabel', 'odialabel', 'punjabilabel',
] as const;

const LOCALES: Array<[string, Record<string, unknown>]> = [
  ['en', en as Record<string, unknown>], ['hi', hi as Record<string, unknown>],
  ['mr', mr as Record<string, unknown>], ['gu', gu as Record<string, unknown>],
  ['ta', ta as Record<string, unknown>], ['te', te as Record<string, unknown>],
  ['kn', kn as Record<string, unknown>], ['ml', ml as Record<string, unknown>],
  ['bn', bn as Record<string, unknown>], ['or', or as Record<string, unknown>],
  ['pa', pa as Record<string, unknown>],
];

describe('support-staff taxonomy: categories', () => {
  it('has exactly 10 support-staff category values, all unique', () => {
    expect(SUPPORT_STAFF_CATEGORY_VALUES).toHaveLength(10);
    expect(new Set(SUPPORT_STAFF_CATEGORY_VALUES).size).toBe(10);
  });

  it.each(SUPPORT_STAFF_CATEGORY_VALUES)('category "%s" exists with >=1 subcategory', (value) => {
    const cat = byValue(value);
    expect(cat).toBeDefined();
    expect(cat?.subcategories?.length ?? 0).toBeGreaterThan(0);
  });

  it('every support category has a cat_<value> key in all 11 locales', () => {
    const missing: string[] = [];
    for (const value of SUPPORT_STAFF_CATEGORY_VALUES) {
      for (const [code, dict] of LOCALES) {
        const v = dict[`cat_${value}`];
        if (typeof v !== 'string' || v.trim() === '') missing.push(`${code}:cat_${value}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe('support-staff taxonomy: subcategories (11-language completeness)', () => {
  it('every support subcategory has a non-empty English label + all 10 native labels', () => {
    const problems: string[] = [];
    for (const value of SUPPORT_STAFF_CATEGORY_VALUES) {
      const cat = byValue(value);
      for (const sub of cat?.subcategories ?? []) {
        if (!sub.label?.trim()) problems.push(`${value}/${sub.value}: empty label`);
        if (!sub.value?.trim()) problems.push(`${value}: subcategory with empty value`);
        for (const field of SUBCAT_LANG_FIELDS) {
          if (!sub[field]?.trim()) problems.push(`${value}/${sub.value}: missing ${field}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('subcategory values are unique within each category', () => {
    for (const value of SUPPORT_STAFF_CATEGORY_VALUES) {
      const subs = byValue(value)?.subcategories ?? [];
      const vals = subs.map((s) => s.value);
      expect(new Set(vals).size).toBe(vals.length);
    }
  });
});

describe('support-staff taxonomy: no regression', () => {
  it('keeps the legacy Permanent/Contract categories in categories.json', () => {
    for (const value of LEGACY_SUPPORT_STAFF_VALUES) {
      expect(byValue(value)).toBeDefined();
    }
  });

  it('keeps legacy cat_ keys in the English locale', () => {
    expect((en as Record<string, unknown>).cat_support_staff_permanent).toBeTruthy();
    expect((en as Record<string, unknown>).cat_support_staff_contract).toBeTruthy();
  });

  it('hides both new and legacy support categories from the non-support set', () => {
    for (const v of [...SUPPORT_STAFF_CATEGORY_VALUES, ...LEGACY_SUPPORT_STAFF_VALUES]) {
      expect(HIDDEN_FROM_NON_SUPPORT.has(v)).toBe(true);
    }
  });

  it('does NOT hide ordinary worker categories (e.g. construction)', () => {
    // a representative non-support category must remain selectable elsewhere
    const sample = CATS.find((c) => c.value === 'construction_project_workers');
    expect(sample).toBeDefined();
    expect(HIDDEN_FROM_NON_SUPPORT.has('construction_project_workers')).toBe(false);
  });
});
