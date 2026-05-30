import { translation as en } from './locales/en';
import { translation as hi } from './locales/hi';
import { translation as mr } from './locales/mr';
import { translation as gu } from './locales/gu';
import { translation as ta } from './locales/ta';
import { translation as te } from './locales/te';
import { translation as kn } from './locales/kn';
import { translation as ml } from './locales/ml';
import { translation as bn } from './locales/bn';
import { translation as or } from './locales/or';
import { translation as pa } from './locales/pa';

// ── Employer namespace (separate from agent/worker default namespace) ──────────
import { employerTranslation as empEn } from './locales/employer/en';
import { employerTranslation as empHi } from './locales/employer/hi';
import { employerTranslation as empMr } from './locales/employer/mr';
import { employerTranslation as empGu } from './locales/employer/gu';
import { employerTranslation as empTa } from './locales/employer/ta';
import { employerTranslation as empTe } from './locales/employer/te';
import { employerTranslation as empKn } from './locales/employer/kn';
import { employerTranslation as empMl } from './locales/employer/ml';
import { employerTranslation as empBn } from './locales/employer/bn';
import { employerTranslation as empOr } from './locales/employer/or';
import { employerTranslation as empPa } from './locales/employer/pa';

export const resources = {
  en: { translation: en, employer: empEn },
  hi: { translation: hi, employer: empHi },
  mr: { translation: mr, employer: empMr },
  gu: { translation: gu, employer: empGu },
  ta: { translation: ta, employer: empTa },
  te: { translation: te, employer: empTe },
  kn: { translation: kn, employer: empKn },
  ml: { translation: ml, employer: empMl },
  bn: { translation: bn, employer: empBn },
  or: { translation: or, employer: empOr },
  pa: { translation: pa, employer: empPa },
} as const;

export type TranslationKeys = keyof typeof resources.en.translation;

export const LANGUAGE_OPTIONS: Array<{ value: string; nativeLabel: string; englishLabel: string }> = [
  { value: 'en', nativeLabel: 'English', englishLabel: 'English' },
  { value: 'hi', nativeLabel: 'हिंदी', englishLabel: 'Hindi' },
  { value: 'mr', nativeLabel: 'मराठी', englishLabel: 'Marathi' },
  { value: 'gu', nativeLabel: 'ગુજρاتī', englishLabel: 'Gujarati' },
  { value: 'ta', nativeLabel: 'தமிழ்', englishLabel: 'Tamil' },
  { value: 'te', nativeLabel: 'తెలుగు', englishLabel: 'Telugu' },
  { value: 'kn', nativeLabel: 'ಕನ್ನಡ', englishLabel: 'Kannada' },
  { value: 'ml', nativeLabel: 'മലയാളം', englishLabel: 'Malayalam' },
  { value: 'bn', nativeLabel: 'বাংলা', englishLabel: 'Bengali' },
  { value: 'or', nativeLabel: 'ଓଡ଼ିଆ', englishLabel: 'Odia' },
  { value: 'pa', nativeLabel: 'ਪੰਜਾਬੀ', englishLabel: 'Punjabi' },
];
