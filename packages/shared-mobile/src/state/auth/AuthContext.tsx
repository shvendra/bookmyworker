import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  clearAuthSession,
  loadAuthSession,
  saveAuthSession,
} from '../../core/storage/authStorage';
import i18n from '../../core/i18n';
import { queryClient } from '../../core/query/queryClient';
import { resetToWelcome } from '../../core/navigation/navigationRef';
import { registerSignOutHandler, unregisterSignOutHandler } from './authEventBus';
import { getCurrentUser, setDefaultRoleApi, updateProfileFields } from '../../core/api/endpoints/authApi';
import { apiClient } from '../../core/api/client';
import { notificationApi } from '../../core/api/endpoints/notificationApi';
import { registerForPushNotifications } from '../../core/notifications/pushService';
import { authService } from '../../features/auth/services/authService';
import type { AppLanguage, AppRole } from '../../shared/types/domain';
import type { AuthContextValue, AuthSession, AuthState } from './authTypes';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: React.PropsWithChildren): React.JSX.Element => {
  const [state, setState] = useState<AuthState>({
    status: 'loading',
    session: null,
  });

  useEffect(() => {
    const bootstrap = async (): Promise<void> => {
      const session = await loadAuthSession();
      if (session) {
        setState({ status: 'authenticated', session });
        // Only apply DB language if one is saved — never reset to 'en' for users
        // who haven't had their language saved to the DB yet (e.g. mid-registration).
        if (session.user.language) {
          void i18n.changeLanguage(session.user.language);
        }
        // Refresh availableRoles from backend in background
        void (async () => {
          try {
            const freshUser = await getCurrentUser();
            // getCurrentUser returns UserProfile but we also need availableRoles
            // Fetch via getUser endpoint which now returns availableRoles
            const res = await apiClient.get('/api/v1/user/getuser');
            const body = res.data as { availableRoles?: string[]; defaultRole?: string };
            if (body.availableRoles && body.availableRoles.length > 0) {
              setState((prev) => {
                if (!prev.session) return prev;
                const updated = {
                  ...prev.session,
                  availableRoles: body.availableRoles,
                  defaultRole: body.defaultRole ?? prev.session.defaultRole,
                  user: { ...prev.session.user, ...freshUser },
                };
                void saveAuthSession(updated);
                return { ...prev, session: updated };
              });
            }
          } catch {
            // silently ignore — stale roles are fine
          }
        })();
      } else {
        setState({ status: 'unauthenticated', session: null });
      }
    };

    void bootstrap();
  }, []);

  useEffect(() => {
    const handler = (): void => {
      setState({ status: 'unauthenticated', session: null });
      queryClient.clear();
      resetToWelcome();
      void (async () => {
        try { await clearAuthSession(); } catch {}
      })();
    };
    registerSignOutHandler(handler);
    return () => { unregisterSignOutHandler(); };
  }, []);

  const signIn = useCallback(async (session: AuthSession): Promise<void> => {
    await saveAuthSession(session);
    setState({ status: 'authenticated', session });
    // Register push token in background — never block the login flow
    void (async () => {
      try {
        const token = await registerForPushNotifications();
        if (token) await notificationApi.registerToken(token);
      } catch { /* silently ignore — push is non-critical */ }
    })();
  }, []);

  const signOut = useCallback((): void => {
    // 1. Clear queries first so no stale data lingers
    queryClient.clear();
    // 2. Update auth state — this drives the conditional screen list in AppNavigator
    //    The AppNavigator's useEffect will call resetToWelcome() AFTER the screens
    //    are re-rendered with the auth screen set (so Welcome actually exists).
    setState({ status: 'unauthenticated', session: null });
    // 3. Background cleanup — never blocks UI
    void (async () => {
      try { await clearAuthSession(); } catch {}
      try {
        await notificationApi.removeToken();
      } catch {}
      try {
        await apiClient.post('/api/v1/user/logout');
      } catch {}
    })();
  }, []);

  const patchSession = useCallback(
    async (updater: (session: AuthSession) => AuthSession): Promise<void> => {
      setState((previous) => {
        if (!previous.session) {
          return previous;
        }
        const updatedSession = updater(previous.session);
        void saveAuthSession(updatedSession);
        return { ...previous, session: updatedSession };
      });
    },
    []
  );

  const updateRole = useCallback(
    async (role: AppRole): Promise<void> => {
      await patchSession((session) => ({
        ...session,
        user: { ...session.user, role },
      }));
    },
    [patchSession]
  );

  const switchRole = useCallback(
    async (backendRole: string): Promise<void> => {
      const session = await loadAuthSession();
      const phone = session?.user?.phone;
      if (!phone) throw new Error('No active session — cannot switch role');
      const newSession = await authService.switchRole(backendRole, phone);
      await saveAuthSession(newSession);
      queryClient.clear();
      setState({ status: 'authenticated', session: newSession });
      if (newSession.user.language) {
        void i18n.changeLanguage(newSession.user.language);
      }
    },
    []
  );

  const setDefaultRole = useCallback(
    async (backendRole: string): Promise<void> => {
      await setDefaultRoleApi(backendRole);
      // Update local session so the UI reflects the new default immediately
      setState((prev) => {
        if (!prev.session) return prev;
        const updated = { ...prev.session, defaultRole: backendRole };
        void saveAuthSession(updated);
        return { ...prev, session: updated };
      });
    },
    []
  );

  const updateProfile = useCallback(
    async (updates: Partial<AuthSession['user']>): Promise<void> => {
      await patchSession((session) => ({
        ...session,
        user: {
          ...session.user,
          ...updates,
        },
      }));
    },
    [patchSession]
  );
  const completeOnboarding = useCallback(async (): Promise<void> => {
    await patchSession((session) => ({
      ...session,
      onboardingCompleted: true,
    }));
  }, [patchSession]);

  const setLanguage = useCallback(
    async (language: AppLanguage): Promise<void> => {
      // 1. Update local session immediately so the UI reacts
      await patchSession((session) => ({
        ...session,
        user: { ...session.user, language },
      }));
      // 2. Persist to DB so the choice survives re-login (non-fatal)
      void updateProfileFields({ language }).catch(() => {});
      // 3. Apply to i18n
      void i18n.changeLanguage(language);
    },
    [patchSession]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      signIn,
      signOut,
      updateRole,
      switchRole,
      setDefaultRole,
      updateProfile,
      completeOnboarding,
      setLanguage,
    }),
    [state, signIn, signOut, updateRole, switchRole, setDefaultRole, updateProfile, completeOnboarding, setLanguage]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
};
