import {
  parseOtpMode, parseOtpFlags, resolveOtpUi, otpSendArg, otpKey, otpErrorMessage, otherChannel,
} from '../../../features/auth/utils/otpMode';

const flags = (over: Record<string, unknown> = {}) =>
  parseOtpFlags({ otpChannel: 'whatsapp', otpPrimary: 'whatsapp', otpAlternate: null, otpCanChoose: false, otpUnavailable: false, ...over });

describe('parseOtpMode', () => {
  it("only an explicit 'sms' / 'user' changes anything; everything else is WhatsApp", () => {
    expect(parseOtpMode('sms')).toBe('sms');
    expect(parseOtpMode('user')).toBe('user');
    for (const v of [undefined, null, '', 'SMS', 'voice', 1, {}]) expect(parseOtpMode(v)).toBe('whatsapp');
  });
});

describe('parseOtpFlags — older backends (only otpChannel)', () => {
  it('derives everything from the mode', () => {
    expect(parseOtpFlags({ otpChannel: 'whatsapp' })).toMatchObject({ otpPrimary: 'whatsapp', otpAlternate: null, otpCanChoose: false, otpUnavailable: false });
    expect(parseOtpFlags({ otpChannel: 'sms' })).toMatchObject({ otpPrimary: 'sms', otpAlternate: null, otpCanChoose: false });
    expect(parseOtpFlags({ otpChannel: 'user' })).toMatchObject({ otpPrimary: 'whatsapp', otpAlternate: 'sms', otpCanChoose: true });
    expect(parseOtpFlags(undefined)).toMatchObject({ otpPrimary: 'whatsapp', otpUnavailable: false });
  });
});

describe('parseOtpFlags — availability-aware backend', () => {
  it('reads the live state as sent', () => {
    expect(flags({ otpAlternate: 'sms' })).toMatchObject({ otpPrimary: 'whatsapp', otpAlternate: 'sms' });
    expect(flags({ otpChannel: 'user', otpAlternate: 'sms', otpCanChoose: true }).otpCanChoose).toBe(true);
  });
  it('unavailable clears everything', () => {
    expect(flags({ otpUnavailable: true, otpPrimary: null, otpAlternate: 'sms', otpCanChoose: true })).toMatchObject({
      otpPrimary: null, otpAlternate: null, otpCanChoose: false, otpUnavailable: true,
    });
  });
  it('junk values fall back safely', () => {
    expect(flags({ otpPrimary: 'voice', otpAlternate: 'fax' })).toMatchObject({ otpPrimary: 'whatsapp', otpAlternate: null });
  });
});

describe('resolveOtpUi', () => {
  it('fixed WhatsApp, SMS usable: WhatsApp in use, SMS is the alternate, no picker', () => {
    expect(resolveOtpUi(flags({ otpAlternate: 'sms' }), null)).toEqual({ channel: 'whatsapp', primary: 'whatsapp', alternate: 'sms', canChoose: false, unavailable: false });
  });
  it('a DOWN alternate is not offered', () => {
    expect(resolveOtpUi(flags({ otpAlternate: null }), null).alternate).toBeNull();
  });
  it('"try another way" (override) switches the channel and offers the way back', () => {
    const ui = resolveOtpUi(flags({ otpAlternate: 'sms' }), 'sms');
    expect(ui).toMatchObject({ channel: 'sms', primary: 'whatsapp', alternate: 'whatsapp' });
  });
  it('an override to an unusable channel is ignored', () => {
    expect(resolveOtpUi(flags({ otpAlternate: null }), 'sms').channel).toBe('whatsapp');
  });
  it("'user' mode shows the picker; the person's pick is used", () => {
    const f = flags({ otpChannel: 'user', otpAlternate: 'sms', otpCanChoose: true });
    expect(resolveOtpUi(f, null)).toMatchObject({ channel: 'whatsapp', canChoose: true });
    expect(resolveOtpUi(f, 'sms')).toMatchObject({ channel: 'sms', canChoose: true });
  });
  it('failover: SMS primary because WhatsApp is down — and nothing offered', () => {
    expect(resolveOtpUi(flags({ otpChannel: 'sms', otpPrimary: 'sms', otpAlternate: null }), null)).toMatchObject({ channel: 'sms', alternate: null });
  });
  it('both down: unavailable, nothing offered', () => {
    expect(resolveOtpUi(flags({ otpUnavailable: true }), 'sms')).toEqual({ channel: 'whatsapp', primary: 'whatsapp', alternate: null, canChoose: false, unavailable: true });
  });
});

describe('otpSendArg — the request payload', () => {
  const ui = (over: Record<string, unknown> = {}, ov: 'whatsapp' | 'sms' | null = null) => resolveOtpUi(flags(over), ov);
  it('nothing chosen in a fixed mode → undefined (the exact legacy request)', () => {
    expect(otpSendArg(ui({ otpAlternate: 'sms' }), null)).toBeUndefined();
  });
  it("user mode always states the channel", () => {
    const u = ui({ otpChannel: 'user', otpAlternate: 'sms', otpCanChoose: true });
    expect(otpSendArg(u, null)).toEqual({ channel: 'whatsapp' });
    expect(otpSendArg(ui({ otpChannel: 'user', otpAlternate: 'sms', otpCanChoose: true }, 'sms'), 'sms')).toEqual({ channel: 'sms', alternate: true });
  });
  it('"try another way" in a fixed mode is flagged as alternate', () => {
    expect(otpSendArg(ui({ otpAlternate: 'sms' }, 'sms'), 'sms')).toEqual({ channel: 'sms', alternate: true });
  });
  it('an explicit `via` wins (resend through the other channel)', () => {
    expect(otpSendArg(ui({ otpAlternate: 'sms' }), null, 'sms')).toEqual({ channel: 'sms', alternate: true });
  });
});

describe('helpers', () => {
  it('otherChannel / otpKey', () => {
    expect(otherChannel('sms')).toBe('whatsapp');
    expect(otherChannel('whatsapp')).toBe('sms');
    expect(otpKey('sms', 'sendOtpViaWhatsApp')).toBe('sendOtpViaSms');
    expect(otpKey('whatsapp', 'sendOtpViaWhatsApp')).toBe('sendOtpViaWhatsApp');
  });
  it("otpErrorMessage prefers the server's words", () => {
    expect(otpErrorMessage({ response: { data: { message: 'Temporarily unavailable' } } }, 'x')).toBe('Temporarily unavailable');
    expect(otpErrorMessage(new Error('boom'), 'x')).toBe('boom');
    expect(otpErrorMessage({}, 'fallback')).toBe('fallback');
  });
});
