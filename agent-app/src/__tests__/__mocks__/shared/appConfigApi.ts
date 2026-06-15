// appConfigApi mock. `useAppConfig` returns a static config so the Welcome /
// Login screens render without a react-query provider. `formatStat` mirrors the
// real "round to k/M" formatter closely enough for label assertions.
// `authFlags` is mutable so tests can flip the SuperAdmin OTP toggle. Default is
// enabled, matching the real DEFAULTS, so existing flows keep the OTP path.
export const __authFlags = { registrationOtpEnabled: true, loginOtpEnabled: true };

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
  __appConfig.isLoading = false;
};

export function formatStat(n: number): string {
  if (n >= 1000) return `${Math.floor(n / 1000)}k+`;
  return `${n}`;
}

export function useAppConfig() {
  return { config, isLoading: __appConfig.isLoading };
}
