/** Police Verification must be fully translated in every app language (no English fallbacks, no broken placeholders). */
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
// Mirrors SUPPORTED in core/i18n/index.ts (that module needs the native Expo runtime to import).
const SUPPORTED_LANGUAGES = ['en', 'hi', 'mr', 'gu', 'ta', 'te', 'kn', 'ml', 'bn', 'or', 'pa'];

const LOCALES: Record<string, Record<string, string>> = { hi, mr, gu, ta, te, kn, ml, bn, or, pa } as never;
const EN = en as unknown as Record<string, string>;
const keys = Object.keys(EN).filter((k) => k.startsWith('bgc_') || k === 'tx_method_bgc');
const ph = (s: string) => (s.match(/\{\{\w+\}\}/g) ?? []).sort().join(',');

describe('Police Verification translations', () => {
  it('has a substantial English source set', () => {
    expect(keys.length).toBeGreaterThan(110);
  });
  it('covers every language the app supports', () => {
    expect(Object.keys(LOCALES).concat('en').sort()).toEqual([...SUPPORTED_LANGUAGES].sort());
  });
  it.each(Object.keys(LOCALES))('%s: every key is present, non-empty and keeps the exact {{placeholders}}', (lang) => {
    const L = LOCALES[lang]!;
    const missing = keys.filter((k) => typeof L[k] !== 'string' || !L[k]!.trim());
    expect(missing).toEqual([]);
    const brokenPlaceholders = keys.filter((k) => ph(L[k]!) !== ph(EN[k]!));
    expect(brokenPlaceholders).toEqual([]);
  });
  it.each(Object.keys(LOCALES))('%s: is actually translated (not a copy of English) for the user-facing strings', (lang) => {
    const L = LOCALES[lang]!;
    // only technical/brand tokens may legitimately equal English
    const allowed = new Set(['bgc_gst']);
    const sameAsEnglish = keys.filter((k) => L[k] === EN[k] && !allowed.has(k));
    expect(sameAsEnglish).toEqual([]);
  });
  it('status and message labels exist for every case status the server can send', () => {
    for (const s of ['awaiting_payment', 'received', 'documents_review', 'police_verification', 'on_hold', 'clear', 'adverse', 'cancelled']) {
      expect(EN[`bgc_status_${s}`]).toBeTruthy();
      expect(EN[`bgc_msg_${s}`]).toBeTruthy();
    }
  });
});
