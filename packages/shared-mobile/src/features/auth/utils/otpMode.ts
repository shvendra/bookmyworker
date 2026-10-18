import { parseOtpMode, parseOtpFlags, DEFAULT_OTP_FLAGS, type OtpChannel, type OtpMode, type OtpFlags } from '../../../core/api/otpFlags';

export { parseOtpMode, parseOtpFlags, DEFAULT_OTP_FLAGS };
export type { OtpChannel, OtpMode, OtpFlags };

export const otherChannel = (c: OtpChannel): OtpChannel => (c === 'sms' ? 'whatsapp' : 'sms');

/** What one OTP screen shows and sends. */
export interface OtpUi {
  /** Channel in use (SuperAdmin's default after failover, or the person's pick / "try another way"). */
  channel: OtpChannel;
  /** SuperAdmin's default channel after failover. */
  primary: OtpChannel;
  /** The OTHER channel when it is usable — offered as "Try another way". null when it is down / not configured. */
  alternate: OtpChannel | null;
  /** "User chooses" mode and both channels work → show the picker. */
  canChoose: boolean;
  /** Neither channel works right now — show "OTP temporarily unavailable", offer nothing. */
  unavailable: boolean;
}

export function resolveOtpUi(flags: OtpFlags, override: OtpChannel | null): OtpUi {
  if (flags.otpUnavailable || flags.otpPrimary === null) {
    return { channel: 'whatsapp', primary: 'whatsapp', alternate: null, canChoose: false, unavailable: true };
  }
  const primary = flags.otpPrimary;
  const usable = new Set<OtpChannel>([primary]);
  if (flags.otpAlternate) usable.add(flags.otpAlternate);
  const channel = override && usable.has(override) ? override : primary;
  const other = otherChannel(channel);
  return { channel, primary, alternate: usable.has(other) ? other : null, canChoose: flags.otpCanChoose, unavailable: false };
}

/** What the request carries. Undefined keeps the exact legacy payload (no choice made, nothing to override). */
export interface OtpSend { channel: OtpChannel; alternate?: boolean }

export function otpSendArg(ui: OtpUi, override: OtpChannel | null, via?: OtpChannel): OtpSend | undefined {
  const channel = via ?? (ui.canChoose || override !== null ? ui.channel : undefined);
  if (!channel) return undefined;
  return { channel, ...(channel !== ui.primary ? { alternate: true } : {}) };
}

/** The server's own words ("OTP temporarily unavailable…") when it sent any, else the error's message, else `fallback`. */
export function otpErrorMessage(error: unknown, fallback: string): string {
  const m = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  if (typeof m === 'string' && m) return m;
  return error instanceof Error && error.message ? error.message : fallback;
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
