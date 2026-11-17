import { resources } from '../../core/i18n/translations';

// Every employer-screen string must exist in every language — otherwise that language silently shows English.
describe('employer i18n namespace parity', () => {
  const en = Object.keys(resources.en.employer);
  const langs = Object.keys(resources) as (keyof typeof resources)[];
  const placeholders = (s: unknown): string[] => (String(s).match(/\{\{\w+\}\}/g) ?? []).sort();

  it.each(langs)('%s has every key of English', (lang) => {
    const have = new Set(Object.keys(resources[lang].employer));
    const missing = en.filter((k) => !have.has(k));
    expect(missing).toEqual([]);
  });

  it.each(langs)('%s keeps the {{placeholders}} of English', (lang) => {
    const bad = en.filter((k) => {
      const v = (resources[lang].employer as Record<string, unknown>)[k];
      return v !== undefined && JSON.stringify(placeholders(v)) !== JSON.stringify(placeholders((resources.en.employer as Record<string, unknown>)[k]));
    });
    expect(bad).toEqual([]);
  });

  it('the new Edit Requirement + Happy Customers strings exist everywhere', () => {
    for (const lang of langs) {
      const e = resources[lang].employer as unknown as Record<string, string>;
      for (const k of ['er_title', 'er_save', 'er_errRange', 'hc_title', 'hc_cta']) expect(e[k]).toBeTruthy();
    }
  });
});
