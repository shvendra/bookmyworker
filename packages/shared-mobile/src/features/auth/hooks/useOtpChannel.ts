import { useState } from 'react';
import { useAppConfig } from '../../../core/api/endpoints/appConfigApi';
import {
  parseOtpFlags, resolveOtpUi, otpSendArg, otpKey, otpChannelWord, otherChannel,
  type OtpChannel, type OtpMode, type OtpSend,
} from '../utils/otpMode';

export { otpKey, otpChannelWord, otherChannel };
export type { OtpChannel, OtpMode, OtpSend };

/**
 * Everything one OTP screen needs (SuperAdmin → Settings → Authentication & OTP, plus live channel health):
 *  - `channel`      channel in use: SuperAdmin's default, or the person's pick / "try another way"
 *  - `canChoose`    "user chooses" mode and both channels work → show <OtpChannelPicker/>
 *  - `alternate`    the OTHER channel when it is usable → offer "Try another way"; null when it is down
 *  - `unavailable`  neither channel works → show "OTP temporarily unavailable", offer nothing
 *  - `sendArg(via)` what to pass to the send call (undefined keeps the legacy payload)
 * WhatsApp is the default until the person (or SuperAdmin's failover) says otherwise. `initial` carries a choice made
 * on a previous screen.
 */
export function useOtpChoice(initial?: OtpChannel) {
  const { config } = useAppConfig();
  const flags = parseOtpFlags(config?.authFlags);
  const [override, setOverride] = useState<OtpChannel | null>(initial ?? null);
  const ui = resolveOtpUi(flags, override);
  return {
    mode: flags.otpChannel,
    ...ui,
    setChannel: (c: OtpChannel): void => setOverride(c),
    sendArg: (via?: OtpChannel): OtpSend | undefined => otpSendArg(ui, override, via),
  };
}

/** Wording-only channel (no picker). */
export function useOtpChannel(): OtpChannel {
  return useOtpChoice().channel;
}
