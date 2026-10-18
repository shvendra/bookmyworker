// Test double for features/auth/hooks/useOtpChannel — same behaviour, reading the mutable __authFlags of the
// appConfigApi mock. The pure rules (parse / resolve / send payload / key mapping) are the REAL ones from utils/otpMode.
import { useState } from 'react';
import { __authFlags } from './appConfigApi';
import {
  parseOtpFlags, resolveOtpUi, otpSendArg, otpKey, otpChannelWord, otherChannel, type OtpChannel,
} from '../../../../../packages/shared-mobile/src/features/auth/utils/otpMode';

export { otpKey, otpChannelWord, otherChannel };

export function useOtpChoice(initial?: OtpChannel) {
  const flags = parseOtpFlags(__authFlags);
  const [override, setOverride] = useState<OtpChannel | null>(initial ?? null);
  const ui = resolveOtpUi(flags, override);
  return {
    mode: flags.otpChannel,
    ...ui,
    setChannel: (c: OtpChannel) => setOverride(c),
    sendArg: (via?: OtpChannel) => otpSendArg(ui, override, via),
  };
}

export function useOtpChannel(): OtpChannel {
  return useOtpChoice().channel;
}
