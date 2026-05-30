import type { UserProfile } from '../types/domain';

export function isWorkerProfileComplete(user: UserProfile | null | undefined): boolean {
  if (!user) return true;
  const role = (user.role ?? '').toLowerCase();
  if (!['selfworker', 'worker', 'agent'].includes(role)) return true;
  return !!(user.gender && user.dob);
}
