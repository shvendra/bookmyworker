import { requestOtp, verifyOtp, registerUser, verifyOtpOnly, switchRoleApi, type RegisterPayload } from '../../../core/api/endpoints/authApi';
import { registerForPushNotifications } from '../../../core/notifications/pushService';
import { notificationApi } from '../../../core/api/endpoints/notificationApi';
import type { AuthSession } from '../../../state/auth/authTypes';
import type { AppRole, UserProfile } from '../../../shared/types/domain';

const mockUser = (phone: string): UserProfile => ({
  id: 'dev-user-id',
  fullName: 'Demo Worker',
  phone,
  role: 'worker',
  kycStatus: 'pending',
  language: 'en',
});

export const authService = {
  requestOtp: async (phone: string, roleHint?: AppRole): Promise<{ message: string }> =>
    requestOtp({ phone, roleHint }),

  verifyOtp: async ({ phone, otp, roleHint }: { phone: string; otp: string; roleHint?: import('../../../shared/types/domain').AppRole }): Promise<AuthSession> => {
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
      onboardingCompleted: true,
      availableRoles: response.availableRoles,
    };
  },

  register: async (payload: RegisterPayload): Promise<void> => {
    await registerUser(payload);
  },

  verifyOtpForRegistration: async (phone: string, otp: string): Promise<void> => {
    if (__DEV__ && otp === '123456') return;
    await verifyOtpOnly(phone, otp);
  },

  // Called after registration to get a session token via OTP login
  loginAfterRegister: async (phone: string, otp: string): Promise<AuthSession> => {
    const pushToken = await registerForPushNotifications();
    const response = await verifyOtp({ phone, otp });
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
      onboardingCompleted: false,
      availableRoles: response.availableRoles,
    };
  },

  // Switch to a different role account (same phone number)
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
      // Remove push token from server
      await notificationApi.removeToken();
    } catch {
      // ignore errors on token removal
    }
    try {
      // Clear server-side cookie
      const { apiClient } = await import('../../../core/api/client');
      await apiClient.get('/api/v1/user/logout');
    } catch {
      // ignore errors — local session will be cleared anyway
    }
  },
};
