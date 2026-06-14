import { DIPLOMA_GRADUATE_SUBTYPE } from './supportStaffCategories';

/**
 * Single source of truth for the job-seeker qualification tiers stored on the
 * worker profile as `workerSubType`. Used by RegisterScreen, EditProfileScreen and
 * ProfileCompletionModal so the option list NEVER diverges between
 * register / onboarding / edit (which previously drifted out of sync).
 *
 * `labelKey`/`descKey` are i18n keys present in all 11 main-namespace locales.
 * `value` strings must stay in sync with the backend `userSchema.workerSubType`
 * enum.
 */
export const WORKER_QUALIFICATION_TIERS = [
  { value: 'Skilled',                labelKey: 'workerTypeSkilled',     descKey: 'workerTypeSkilledDesc',     icon: '🔧' },
  { value: 'Unskilled',              labelKey: 'workerTypeUnskilled',   descKey: 'workerTypeUnskilledDesc',   icon: '🏗️' },
  { value: '10th/12th/ITI',          labelKey: 'workerTypeSchoolIti',   descKey: 'workerTypeSchoolItiDesc',   icon: '🎓' },
  { value: DIPLOMA_GRADUATE_SUBTYPE, labelKey: 'workerTypeDiplomaGrad', descKey: 'workerTypeDiplomaGradDesc', icon: '📜' },
] as const;

// Presentational accent colour per tier (used by the onboarding option cards).
export const WORKER_TIER_COLOR: Record<string, string> = {
  Skilled: '#F97316',
  Unskilled: '#14B8A6',
  '10th/12th/ITI': '#6366F1',
  [DIPLOMA_GRADUATE_SUBTYPE]: '#8B5CF6',
};
