import fs from 'fs';
import path from 'path';
import i18next from 'i18next';
import { resources } from '../../core/i18n/translations';

const SRC = path.resolve(__dirname, '../..');
const langs = Object.keys(resources) as (keyof typeof resources)[];

// Files added/changed for Edit Requirement + Happy Customers.
const FILES = [
  'features/jobs/components/EditRequirementSheet.tsx',
  'features/jobs/utils/editRequirement.ts',
  'features/employer/components/HappyCustomersCard.tsx',
];
const usedKeys = (): string[] => {
  const keys = new Set<string>();
  for (const f of FILES) {
    const s = fs.readFileSync(path.join(SRC, f), 'utf8');
    for (const m of s.matchAll(/\bt\('((?:er|hc)_\w+)'/g)) keys.add(m[1]);
    for (const m of s.matchAll(/'((?:er)_err\w+)'/g)) keys.add(m[1]); // validation returns keys
  }
  // keys the detail screen uses for the edit flow
  const d = fs.readFileSync(path.join(SRC, 'features/jobs/screens/RequirementDetailScreen.tsx'), 'utf8');
  for (const m of d.matchAll(/\bt\('(er_\w+)'/g)) keys.add(m[1]);
  return [...keys].sort();
};

// Unicode block each language must be written in (BookMyWorker / ₹ / digits are allowed anywhere).
const SCRIPT: Record<string, RegExp | null> = {
  en: null,
  hi: /[ऀ-ॿ]/, mr: /[ऀ-ॿ]/, gu: /[઀-૿]/, ta: /[஀-௿]/, te: /[ఀ-౿]/,
  kn: /[ಀ-೿]/, ml: /[ഀ-ൿ]/, bn: /[ঀ-৿]/, or: /[଀-୿]/, pa: /[਀-੿]/,
};

describe('new employer-app features: every string is present, localized and renders in all 11 languages', () => {
  const keys = usedKeys();

  it('finds the keys the new screens actually use', () => {
    expect(keys.length).toBeGreaterThanOrEqual(25);
    expect(keys).toEqual(expect.arrayContaining(['er_editBtn', 'er_save', 'er_errRange', 'hc_kicker', 'hc_title', 'hc_sub', 'hc_cta']));
  });

  it.each(langs)('%s: all used keys exist, are non-empty and written in the right script', (lang) => {
    const dict = resources[lang].employer as unknown as Record<string, string>;
    const bad: string[] = [];
    for (const k of keys) {
      const v = dict[k];
      if (typeof v !== 'string' || !v.trim()) { bad.push(`${k}: missing`); continue; }
      const re = SCRIPT[lang];
      if (re && !re.test(v)) bad.push(`${k}: not in ${lang} script → ${v}`);
    }
    expect(bad).toEqual([]);
  });

  it.each(langs)('%s: placeholders / interpolation resolve (coupon, progress, feedback)', async (lang) => {
    const inst = i18next.createInstance();
    await inst.init({ lng: lang, fallbackLng: false, ns: ['employer'], defaultNS: 'employer', resources: { [lang]: { employer: resources[lang].employer } } as never, interpolation: { escapeValue: false } });
    const out = [
      inst.t('eb_couponSavedFmt', { percent: 10, amount: 500 }),
      inst.t('wf_progress_label', { done: 3, total: 5 }),
      inst.t('fb_improveHint', { count: 3 }),
      inst.t('fb_sharedOn', { date: '10 Nov' }),
      inst.t('fb_askAgain', { date: '10 Dec' }),
    ];
    for (const o of out) expect(o).not.toMatch(/\{\{|\}\}/);
    expect(out[0]).toMatch(/10/);
    expect(out[0]).toMatch(/500/);
    expect(out[1]).toMatch(/3/);
    expect(out[1]).toMatch(/5/);
  });

  it('previously English-only features (Feedback, User Guide, Workforce help, coupon) are localized in the 9 backfilled languages', () => {
    const en = resources.en.employer as unknown as Record<string, string>;
    for (const lang of ['mr', 'gu', 'ta', 'te', 'kn', 'ml', 'bn', 'or', 'pa'] as const) {
      const d = resources[lang].employer as unknown as Record<string, string>;
      for (const k of ['fb_title', 'fb_submit', 'guide_menu', 'wf_help_list_title', 'wf_note_submit', 'eb_couponLabel', 'eb_couponApply']) {
        expect(d[k]).toBeTruthy();
        expect(d[k]).not.toBe(en[k]); // not a silent English copy
      }
    }
  });
});
