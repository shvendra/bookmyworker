import type { UserProfile } from '../types/domain';

// Qualification tiers (current + legacy values) whose candidates must upload an
// education document (10th/12th marksheet, ITI/Diploma certificate, degree)
// before their profile counts as complete. Current values come from
// WORKER_QUALIFICATION_TIERS; 'ITI/Diploma' & 'Graduate' are the legacy
// equivalents still present on older worker records (see userSchema enum).
export const EDUCATION_DOC_SUBTYPES = [
  '10th/12th/ITI',
  'Diploma/Graduate',
  'ITI/Diploma', // legacy
  'Graduate',    // legacy
] as const;

const WORKER_ROLES = ['selfworker', 'worker', 'agent'];

/**
 * True when this worker's qualification tier requires an uploaded education
 * document. Pure agents (no `workerSubType`) and employers always return false.
 */
export function workerNeedsEducationDoc(user: UserProfile | null | undefined): boolean {
  if (!user) return false;
  const role = (user.role ?? '').toLowerCase();
  if (!WORKER_ROLES.includes(role)) return false;
  return EDUCATION_DOC_SUBTYPES.includes((user.workerSubType ?? '') as (typeof EDUCATION_DOC_SUBTYPES)[number]);
}

/**
 * True when the worker's education document has been uploaded. The single
 * `resumeUrl` field is the canonical signal (uploaded via the resume/document
 * banner) so the gate, dashboard badge and profile-strength chip never diverge.
 */
export function hasEducationDoc(user: UserProfile | null | undefined): boolean {
  return !!user?.resumeUrl;
}

export function isWorkerProfileComplete(user: UserProfile | null | undefined): boolean {
  if (!user) return true;
  const role = (user.role ?? '').toLowerCase();
  if (!WORKER_ROLES.includes(role)) return true;
  // Resume upload is optional, so it never gates completeness — gender + age
  // (dob) are the only hard requirements.
  return !!(user.gender && user.dob);
}
