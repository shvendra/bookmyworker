import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import {
  EMPLOYER_PLANS_DEFAULTS,
  type EmployerTypeKey,
  type PlanFeatures,
  type WorkerSearchScope,
} from '../api/endpoints/pricingApi';
import { useAuth } from '../../state/auth/AuthContext';

/**
 * Raw `planFeatures` blob the backend may attach to the user document.
 * Every field is optional — older accounts / older backends may omit some
 * or all of these, so the hook always falls back to the plan defaults
 * derived from the resolved employerType.
 */
type RawPlanFeatures = Partial<PlanFeatures>;

interface RawUser {
  isSubscribed?: boolean;
  subscriptionExpery?: string;
  remainingContacts?: number;
  /** Gifted free-contact unlocks still available (computed by backend). */
  freeContactsRemaining?: number;
  /** Backend may expose remaining job-post quota; often absent — degrade gracefully. */
  remainingPosts?: number;
  postsRemaining?: number;
  employerType?: string | Record<string, boolean>;
  planFeatures?: RawPlanFeatures;
  planLabel?: string;
  subscriptionPlan?: string;
}

export interface PlanFeaturesResult {
  /** Profile finished loading (false ⇒ values are optimistic defaults). */
  loaded: boolean;
  /** Active, non-expired subscription. */
  isSubscribed: boolean;
  /** Resolved employer tier key. */
  employerType: EmployerTypeKey;
  /** Human-readable plan label for display. */
  planLabel: string;

  workerSearchScope: WorkerSearchScope;
  pipelineEnabled: boolean;
  inviteEnabled: boolean;
  attendanceEnabled: boolean;
  analyticsEnabled: boolean;
  analyticsMonths: number;
  exportEnabled: boolean;
  rosterEnabled: boolean;
  unlimitedPosts: boolean;
  priorityListing: boolean;
  bulkPostEnabled: boolean;
  dedicatedSupport: boolean;

  /** Remaining job posts, or null when the backend does not report it. */
  remainingPosts: number | null;
  /** Remaining contact unlocks. */
  remainingContacts: number;
  /** Gifted free-contact unlocks still available (0 ⇒ none / feature off). */
  freeContactsRemaining: number;
}

function resolveEmployerType(raw?: string | Record<string, boolean>): EmployerTypeKey {
  const keys = ['industry', 'agency', 'contractor', 'individual'] as const;
  if (raw && typeof raw === 'object') {
    const match = keys.find((k) => raw[k]);
    if (match) return match;
  }
  const str = String(raw ?? '').toLowerCase();
  return keys.find((k) => str.includes(k)) ?? 'individual';
}

const TYPE_LABELS: Record<EmployerTypeKey, string> = {
  individual: 'Individual',
  contractor: 'Contractor',
  agency: 'Agency',
  industry: 'Industry',
};

/**
 * Reads the current employer's plan-derived feature flags.
 *
 * - Defaults are PERMISSIVE while the profile is loading (mirrors the optimistic
 *   `isSubscribed` pattern in WorkerProfileScreen) so screens never flash a lock
 *   wall before data arrives.
 * - Backend-attached `planFeatures` win; anything missing falls back to the plan
 *   defaults for the resolved employerType (mirrors CRM pricingApi semantics).
 * - `remainingPosts` is null when the backend does not return it — callers must
 *   hide the counter rather than invent a number.
 */
export function usePlanFeatures(): PlanFeaturesResult {
  const { state: authState } = useAuth();
  const sessionUser = authState.session?.user;

  const profileQuery = useQuery({
    queryKey: ['employer-full-profile'],
    queryFn: async () => {
      const res = await apiClient.get<{ user?: RawUser }>('/api/v1/user/getuser');
      return res.data.user ?? null;
    },
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const loaded = profileQuery.isSuccess;
  const profile = profileQuery.data;

  const employerType = resolveEmployerType(
    profile?.employerType ?? sessionUser?.employerType,
  );
  const planDefaults = EMPLOYER_PLANS_DEFAULTS[employerType].features;

  // Live SuperAdmin plan-feature config (Settings.employerPlans) from the public
  // settings endpoint, so changes apply immediately on mobile — matching the CRM.
  // Priority: live admin settings > stored planFeatures (subscription snapshot) > hardcoded.
  const settingsQuery = useQuery({
    queryKey: ['settings-employer-plans'],
    queryFn: async () => {
      const res = await apiClient.get<{ data?: { employerPlans?: Record<string, { features?: Partial<typeof planDefaults> }> } }>('/api/v1/settings/public');
      return res.data?.data?.employerPlans ?? null;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });
  const liveFeatures: Partial<typeof planDefaults> =
    (settingsQuery.isSuccess && settingsQuery.data?.[employerType]?.features) || {};

  const stored = profile?.planFeatures ?? {};
  // hardcoded defaults  <  stored snapshot  <  live admin settings
  const rawFeatures = { ...planDefaults, ...stored, ...liveFeatures };

  // Active subscription: explicit flag + non-expired expiry (mirror CRM).
  const isSubscribed = (() => {
    const subscribed = profile?.isSubscribed ?? sessionUser?.isSubscribed;
    if (!subscribed) return false;
    const exp = profile?.subscriptionExpery ?? sessionUser?.subscriptionExpiry;
    if (!exp) return true;
    return new Date(exp).getTime() > Date.now();
  })();

  // While loading: optimistic permissive defaults so no premature lock walls.
  const pick = <T,>(rawVal: T | undefined, def: T, permissive: T): T => {
    if (!loaded) return permissive;
    return rawVal ?? def;
  };

  const remainingPostsRaw = profile?.remainingPosts ?? profile?.postsRemaining;
  const remainingPosts =
    typeof remainingPostsRaw === 'number' && Number.isFinite(remainingPostsRaw)
      ? remainingPostsRaw
      : null;

  return {
    loaded,
    isSubscribed: loaded ? isSubscribed : true,
    employerType,
    planLabel:
      profile?.planLabel ??
      profile?.subscriptionPlan ??
      TYPE_LABELS[employerType],

    workerSearchScope: pick(rawFeatures.workerSearchScope, planDefaults.workerSearchScope, 'india'),
    pipelineEnabled: pick(rawFeatures.pipelineEnabled, planDefaults.pipelineEnabled, true),
    inviteEnabled: pick(rawFeatures.inviteEnabled, planDefaults.inviteEnabled, true),
    attendanceEnabled: pick(rawFeatures.attendanceEnabled, planDefaults.attendanceEnabled, true),
    analyticsEnabled: pick(rawFeatures.analyticsEnabled, planDefaults.analyticsEnabled, true),
    analyticsMonths: pick(rawFeatures.analyticsMonths, planDefaults.analyticsMonths, planDefaults.analyticsMonths),
    exportEnabled: pick(rawFeatures.exportEnabled, planDefaults.exportEnabled, true),
    rosterEnabled: pick(rawFeatures.rosterEnabled, planDefaults.rosterEnabled, true),
    unlimitedPosts: pick(rawFeatures.unlimitedPosts, planDefaults.unlimitedPosts, true),
    priorityListing: pick(rawFeatures.priorityListing, planDefaults.priorityListing, true),
    bulkPostEnabled: pick(rawFeatures.bulkPostEnabled, planDefaults.bulkPostEnabled, true),
    dedicatedSupport: pick(rawFeatures.dedicatedSupport, planDefaults.dedicatedSupport, true),

    remainingPosts,
    remainingContacts: profile?.remainingContacts ?? sessionUser?.remainingContacts ?? 0,
    freeContactsRemaining: Math.max(0, profile?.freeContactsRemaining ?? 0),
  };
}
