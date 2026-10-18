import { otpKey, otpChannelWord } from '../../../features/auth/hooks/useOtpChannel';
import { translation as en } from '../../../core/i18n/locales/en';
import { translation as hi } from '../../../core/i18n/locales/hi';
import { translation as mr } from '../../../core/i18n/locales/mr';
import { translation as gu } from '../../../core/i18n/locales/gu';
import { translation as ta } from '../../../core/i18n/locales/ta';
import { translation as te } from '../../../core/i18n/locales/te';
import { translation as kn } from '../../../core/i18n/locales/kn';
import { translation as ml } from '../../../core/i18n/locales/ml';
import { translation as bn } from '../../../core/i18n/locales/bn';
import { translation as or } from '../../../core/i18n/locales/or';
import { translation as pa } from '../../../core/i18n/locales/pa';

const WHATSAPP_KEYS = [
  'forgotTrustBadge2', 'resendOtpBtn', 'forgotPasswordDesc', 'otpViaWhatsApp', 'sendOtpViaWhatsApp',
  'enterWhatsAppOtp', 'checkWhatsApp', 'otpWhatsAppPlaceholder', 'otpTrustBadge2', 'registerTrustBadge2',
];

describe('otpKey / otpChannelWord', () => {
  it('keeps every WhatsApp key unchanged on the WhatsApp channel', () => {
    for (const k of WHATSAPP_KEYS) expect(otpKey('whatsapp', k)).toBe(k);
    expect(otpChannelWord('whatsapp')).toBe('WhatsApp');
  });
  it('maps every WhatsApp key to a distinct SMS twin on the SMS channel', () => {
    const twins = WHATSAPP_KEYS.map((k) => otpKey('sms', k));
    expect(new Set(twins).size).toBe(WHATSAPP_KEYS.length);
    for (let i = 0; i < twins.length; i++) expect(twins[i]).not.toBe(WHATSAPP_KEYS[i]);
    expect(otpChannelWord('sms')).toBe('SMS');
  });
});

describe('SMS strings exist in all 11 languages and never mention WhatsApp', () => {
  const locales: Record<string, Record<string, unknown>> = { en, hi, mr, gu, ta, te, kn, ml, bn, or, pa } as never;
  for (const [lang, dict] of Object.entries(locales)) {
    it(`${lang}: every SMS twin is present, non-empty and WhatsApp-free`, () => {
      for (const k of WHATSAPP_KEYS) {
        const twin = otpKey('sms', k);
        const v = dict[twin];
        expect(typeof v).toBe('string');
        expect((v as string).trim().length).toBeGreaterThan(0);
        expect(v as string).not.toMatch(/whatsapp/i);
      }
    });
  }
});
