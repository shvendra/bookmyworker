// appConfigApi mock. `useAppConfig` returns a static config so screens render
// without a react-query provider. `authFlags` is mutable so tests can flip the
// SuperAdmin OTP toggle; default is enabled, matching the real DEFAULTS, so
// existing flows keep the OTP path.
export const __authFlags: Record<string, unknown> & { registrationOtpEnabled: boolean; loginOtpEnabled: boolean } = {
  registrationOtpEnabled: true,
  loginOtpEnabled: true,
  otpChannel: 'whatsapp',
  otpPrimary: 'whatsapp',
  otpAlternate: null,
  otpCanChoose: false,
  otpUnavailable: false,
};

const config = {
  stats: {
    workerCount: 1200,
    agentCount: 300,
    employerCount: 450,
    requirementCount: 800,
  },
  get authFlags() {
    return __authFlags;
  },
};

export const __appConfig = { isLoading: false };

export const __resetAppConfig = (): void => {
  __authFlags.registrationOtpEnabled = true;
  __authFlags.loginOtpEnabled = true;
  __authFlags.otpChannel = 'whatsapp';
  __authFlags.otpPrimary = 'whatsapp';
  __authFlags.otpAlternate = null;
  __authFlags.otpCanChoose = false;
  __authFlags.otpUnavailable = false;
  __appConfig.isLoading = false;
};

export function formatStat(n: number): string {
  if (n >= 1000) return `${Math.floor(n / 1000)}k+`;
  return `${n}`;
}

export function useAppConfig() {
  return { config, isLoading: __appConfig.isLoading };
}
