// appConfigApi mock. `useAppConfig` returns a static config so the Welcome /
// Login screens render without a react-query provider. `formatStat` mirrors the
// real "round to k/M" formatter closely enough for label assertions.
const config = {
  stats: {
    workerCount: 1200,
    agentCount: 300,
    employerCount: 450,
    requirementCount: 800,
  },
};

export const __appConfig = { isLoading: false };

export function formatStat(n: number): string {
  if (n >= 1000) return `${Math.floor(n / 1000)}k+`;
  return `${n}`;
}

export function useAppConfig() {
  return { config, isLoading: __appConfig.isLoading };
}
