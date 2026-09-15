import { requestOtp, verifyOtp, registerUser, verifyOtpOnly, switchRoleApi, loginWithPassword as loginWithPasswordApi, googleStart as googleStartApi, googleRegister as googleRegisterApi, type RegisterPayload, type AppContext } from '../../../core/api/endpoints/authApi';
import { registerForPushNotifications } from '../../../core/notifications/pushService';
import { notificationApi } from '../../../core/api/endpoints/notificationApi';
import type { AuthSession } from '../../../state/auth/authTypes';
import type { AppRole, UserProfile } from '../../../shared/types/domain';
import { isWorkerProfileComplete } from '../../../shared/utils/workerProfileUtils';

// Priority: Agent > SelfWorker > Worker. Applied when user has multiple roles on same phone.
const ROLE_PRIORITY: Record<string, number> = { Agent: 3, SelfWorker: 2, Worker: 1, Employer: 0 };

function pickBestRole(availableRoles: string[]): string {
  return availableRoles.reduce((best, r) =>
    (ROLE_PRIORITY[r] ?? 0) > (ROLE_PRIORITY[best] ?? 0) ? r : best
  , availableRoles[0] ?? '');
}

function toCurrentBackendRole(frontendRole: string): string {
  switch (frontendRole) {
    case 'agent':    return 'Agent';
    case 'worker':   return 'SelfWorker';
    case 'employer': return 'Employer';
    default:         return 'Worker';
  }
}

const mockUser = (phone: string): UserProfile => ({
  id: 'dev-user-id',
  fullName: 'Demo Worker',
  phone,
  role: 'worker',
  kycStatus: 'pending',
  language: 'en',
});

export const authService = {
  requestOtp: async (phone: string, roleHint?: AppRole, appContext?: AppContext): Promise<{ message: string }> =>
    requestOtp({ phone, roleHint, appContext }),

  verifyOtp: async ({ phone, otp, roleHint, appContext }: { phone: string; otp: string; roleHint?: AppRole; appContext?: AppContext }): Promise<AuthSession> => {
    const pushToken = await registerForPushNotifications();

    if (__DEV__ && otp === '123456') {
      return {
        tokens: {
          accessToken: 'dev-access-token',
          refreshToken: 'dev-refresh-token',
          expiresAt: Date.now() + 60 * 60 * 1000,
        },
        user: mockUser(phone),
        onboardingCompleted: true,
      };
    }

    const response = await verifyOtp({ phone, otp, roleHint, appContext });

    // Auto-select highest priority role when no roleHint was given (normal login flow)
    let finalResponse = response;
    if (!roleHint && response.availableRoles && response.availableRoles.length > 1) {
      const best = pickBestRole(response.availableRoles);
      const current = toCurrentBackendRole(response.user.role);
      if (best && best !== current) {
        try {
          finalResponse = await switchRoleApi(best, phone);
          finalResponse.availableRoles = finalResponse.availableRoles ?? response.availableRoles;
        } catch {
          finalResponse = response;
        }
      }
    }

    if (pushToken) {
      notificationApi.registerToken(pushToken).catch(() => {});
    }
    return {
      tokens: {
        accessToken: finalResponse.token,
        refreshToken: finalResponse.token,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      },
      user: finalResponse.user,
      onboardingCompleted: true,
      availableRoles: finalResponse.availableRoles,
    };
  },

  register: async (payload: RegisterPayload): Promise<void> => {
    await registerUser(payload);
  },

  // ── Google Sign-In (employer) ──────────────────────────────────────────────
  // Verify Google credential. Either an existing Employer is logged in (session
  // returned) or the caller must collect a mobile number (needsPhone + ticket).
  googleStart: async (idToken: string, appContext?: AppContext): Promise<{
    loggedIn: boolean; session?: AuthSession; needsPhone?: boolean; name?: string; email?: string; googleTicket?: string;
  }> => {
    const res = await googleStartApi(idToken, appContext);
    if (res.loggedIn && res.session) {
      const pushToken = await registerForPushNotifications();
      if (pushToken) notificationApi.registerToken(pushToken).catch(() => {});
      return {
        loggedIn: true,
        session: {
          tokens: { accessToken: res.session.token, refreshToken: res.session.token, expiresAt: Date.now() + 24 * 60 * 60 * 1000 },
          user: res.session.user,
          onboardingCompleted: true,
          availableRoles: res.session.availableRoles,
        },
      };
    }
    return { loggedIn: false, needsPhone: res.needsPhone, name: res.name, email: res.email, googleTicket: res.googleTicket };
  },

  // Finish Google registration after the mobile number + OTP step.
  googleRegister: async (payload: {
    googleTicket: string; phone: string; name?: string;
    employerType?: unknown; state?: string; district?: string; block?: string; referredBy?: string;
  }): Promise<AuthSession> => {
    const pushToken = await registerForPushNotifications();
    const res = await googleRegisterApi(payload);
    if (pushToken) notificationApi.registerToken(pushToken).catch(() => {});
    return {
      tokens: { accessToken: res.token, refreshToken: res.token, expiresAt: Date.now() + 24 * 60 * 60 * 1000 },
      user: res.user,
      onboardingCompleted: false, // fresh employer → route to KYC
      availableRoles: res.availableRoles,
    };
  },

  verifyOtpForRegistration: async (phone: string, otp: string): Promise<void> => {
    if (__DEV__ && otp === '123456') return;
    await verifyOtpOnly(phone, otp);
  },

  // Login directly with password after registration — no second OTP needed
  loginWithPassword: async (phone: string, password: string, roleHint?: AppRole, appContext?: AppContext): Promise<AuthSession> => {
    const pushToken = await registerForPushNotifications();
    const response = await loginWithPasswordApi({ phone, password, roleHint, appContext });
    if (pushToken) {
      notificationApi.registerToken(pushToken).catch(() => {});
    }
    return {
      tokens: {
        accessToken: response.token,
        refreshToken: response.token,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      },
      user: response.user,
      onboardingCompleted: isWorkerProfileComplete(response.user),
      availableRoles: response.availableRoles,
    };
  },

  // Called after registration to get a session token via OTP login
  loginAfterRegister: async (phone: string, otp: string, roleHint?: AppRole): Promise<AuthSession> => {
    const pushToken = await registerForPushNotifications();
    const response = await verifyOtp({ phone, otp, roleHint });
    if (pushToken) {
      notificationApi.registerToken(pushToken).catch(() => {});
    }
    return {
      tokens: {
        accessToken: response.token,
        refreshToken: response.token,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      },
      user: response.user,
      onboardingCompleted: isWorkerProfileComplete(response.user),
      availableRoles: response.availableRoles,
    };
  },

  switchRole: async (backendRole: string, phone?: string): Promise<AuthSession> => {
    const response = await switchRoleApi(backendRole, phone);
    return {
      tokens: {
        accessToken: response.token,
        refreshToken: response.token,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      },
      user: response.user,
      onboardingCompleted: true,
      availableRoles: response.availableRoles,
    };
  },

  logout: async (): Promise<void> => {
    try {
      await notificationApi.removeToken();
    } catch {
      // ignore
    }
    try {
      const { apiClient } = await import('../../../core/api/client');
      await apiClient.get('/api/v1/user/logout');
    } catch {
      // ignore — local session will be cleared anyway
    }
  },
};
