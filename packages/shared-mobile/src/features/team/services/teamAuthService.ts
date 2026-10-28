import { teamApi } from '../../../core/api/endpoints/teamApi';
import { getCurrentUser } from '../../../core/api/endpoints/authApi';
import { clearAuthSession, saveAuthSession } from '../../../core/storage/authStorage';
import { setTeamMode } from '../../../core/team/teamMode';
import type { AuthSession } from '../../../state/auth/authTypes';
import type { UserProfile } from '../../../shared/types/domain';

/**
 * Log in as an employer's team member (mobile number OR email + OTP, via the company link). Returns a ready session: the token is a TEAM token,
 * kept apart from any personal login, and `session.team` switches the whole app into team mode.
 * Nothing here touches the member's own BookMyWorker account.
 */
export async function loginAsTeamMember(slug: string, identifier: string, otp: string): Promise<AuthSession> {
  const res = await teamApi.login(slug, identifier, otp);
  const tokens = { accessToken: res.token, refreshToken: res.token, expiresAt: Date.now() + 60 * 60 * 1000 };
  const team = { company: res.company, memberName: res.member.name, permissions: res.member.permissions, slug };
  const placeholder: UserProfile = { id: 'team-member', fullName: res.member.name, phone: '', role: 'employer', kycStatus: 'pending', language: 'en' };

  // The token has to be stored (and team mode on) before the gateway call below can carry it.
  await saveAuthSession({ tokens, user: placeholder, onboardingCompleted: true, team });
  setTeamMode(true);
  try {
    const user = await getCurrentUser(); // → the owner's plan / balance / location scope (no private data)
    return { tokens, user: { ...user, fullName: res.company }, onboardingCompleted: true, team };
  } catch (e) {
    await clearAuthSession().catch(() => {});
    setTeamMode(false);
    throw e;
  }
}
