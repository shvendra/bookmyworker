// Pure parsing of the OTP-delivery part of GET /settings/public → `auth`. No React, no I/O.

export type OtpChannel = 'whatsapp' | 'sms';
export type OtpMode = OtpChannel | 'user';

/**
 * What the app may do for OTP delivery right now.
 *  - `otpChannel`    legacy single value ('whatsapp' | 'sms' | 'user') that always matches reality
 *  - `otpPrimary`    channel OTPs go out on by default (after failover); null only when OTP is unavailable
 *  - `otpAlternate`  the OTHER channel when it is usable ("Try another way"); null when it is down / not configured
 *  - `otpCanChoose`  SuperAdmin's "user chooses" mode AND both channels work → show the picker
 *  - `otpUnavailable` neither channel can carry an OTP right now
 */
export interface OtpFlags {
  otpChannel: OtpMode;
  otpPrimary: OtpChannel | null;
  otpAlternate: OtpChannel | null;
  otpCanChoose: boolean;
  otpUnavailable: boolean;
}

const ch = (v: unknown): OtpChannel | null => (v === 'sms' || v === 'whatsapp' ? v : null);

/** Anything other than an explicit 'sms' / 'user' is WhatsApp (today's behaviour). */
export const parseOtpMode = (raw: unknown): OtpMode => (raw === 'sms' || raw === 'user' ? raw : 'whatsapp');

export const DEFAULT_OTP_FLAGS: OtpFlags = {
  otpChannel: 'whatsapp',
  otpPrimary: 'whatsapp',
  otpAlternate: null,
  otpCanChoose: false,
  otpUnavailable: false,
};

/** Normalises the `auth` payload. Older backends only send `otpChannel` — the rest is derived from it. */
export function parseOtpFlags(auth: unknown): OtpFlags {
  const a = (auth && typeof auth === 'object' ? auth : {}) as Record<string, unknown>;
  const mode = parseOtpMode(a.otpChannel);
  const hasAvailability = 'otpPrimary' in a || 'otpAvailable' in a;
  if (!hasAvailability) {
    return {
      otpChannel: mode,
      otpPrimary: mode === 'sms' ? 'sms' : 'whatsapp',
      otpAlternate: mode === 'user' ? 'sms' : null,
      otpCanChoose: mode === 'user',
      otpUnavailable: false,
    };
  }
  const unavailable = a.otpUnavailable === true;
  return {
    otpChannel: mode,
    otpPrimary: unavailable ? null : ch(a.otpPrimary) ?? 'whatsapp',
    otpAlternate: unavailable ? null : ch(a.otpAlternate),
    otpCanChoose: !unavailable && a.otpCanChoose === true,
    otpUnavailable: unavailable,
  };
}
