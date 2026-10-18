import { useAppConfig } from '../../../core/api/endpoints/appConfigApi';

export type OtpChannel = 'whatsapp' | 'sms';

/**
 * Which single channel delivers OTPs right now (SuperAdmin → Settings → Authentication & OTP).
 * Wording only — the server picks the real channel. Defaults to WhatsApp (today's behaviour) whenever the
 * config is missing, still loading, or says anything other than an explicit 'sms'.
 */
export function useOtpChannel(): OtpChannel {
  const { config } = useAppConfig();
  return config?.authFlags?.otpChannel === 'sms' ? 'sms' : 'whatsapp';
}

// WhatsApp-worded i18n key → its SMS-worded twin. The WhatsApp keys (and their translations) are untouched.
const SMS_KEY: Record<string, string> = {
  forgotTrustBadge2: 'forgotTrustBadge2Sms',
  resendOtpBtn: 'resendOtpBtnSms',
  forgotPasswordDesc: 'forgotPasswordDescSms',
  otpViaWhatsApp: 'otpViaSms',
  sendOtpViaWhatsApp: 'sendOtpViaSms',
  enterWhatsAppOtp: 'enterSmsOtp',
  checkWhatsApp: 'checkSms',
  otpWhatsAppPlaceholder: 'otpSmsPlaceholder',
  otpTrustBadge2: 'otpTrustBadge2Sms',
  registerTrustBadge2: 'registerTrustBadge2Sms',
};

/** The i18n key to use for `whatsappKey` under the given channel (unchanged for WhatsApp). */
export function otpKey(channel: OtpChannel, whatsappKey: string): string {
  return channel === 'sms' ? (SMS_KEY[whatsappKey] ?? whatsappKey) : whatsappKey;
}

/** "WhatsApp" / "SMS" — the word to show inline in OTP copy. */
export const otpChannelWord = (channel: OtpChannel): string => (channel === 'sms' ? 'SMS' : 'WhatsApp');
