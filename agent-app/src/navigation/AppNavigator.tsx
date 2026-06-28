import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationDefaultTheme,
  NavigationContainer,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import i18n from '../../../packages/shared-mobile/src/core/i18n';
import { useAppTheme } from '../../../packages/shared-mobile/src/core/theme';
import { useAuth } from '../../../packages/shared-mobile/src/state/auth/AuthContext';
import { LoadingState } from '../../../packages/shared-mobile/src/shared/components/feedback/LoadingState';
import { navigationRef } from '../../../packages/shared-mobile/src/core/navigation/navigationRef';

// Language selection — shown only on very first launch
import { AGENT_LANG_KEY, LanguageSelectScreen } from '../screens/language/LanguageSelectScreen';
import { IntentSelectScreen } from '../screens/intent/IntentSelectScreen';
import { useLangSync } from '../../../packages/shared-mobile/src/core/i18n/useLangSync';

// Auth screens — agent-specific welcome + login + shared auth flow
import { AgentWelcomeScreen } from '../screens/auth/AgentWelcomeScreen';
import { AgentLoginScreen } from '../screens/auth/AgentLoginScreen';
import { OtpVerificationScreen } from '../../../packages/shared-mobile/src/features/auth/screens/OtpVerificationScreen';
import { RegisterOtpScreen } from '../../../packages/shared-mobile/src/features/auth/screens/RegisterOtpScreen';
import { ForgotPasswordScreen } from '../../../packages/shared-mobile/src/features/auth/screens/ForgotPasswordScreen';

// Agent-specific register screen (no Employer option)
import { AgentRegisterScreen } from '../screens/auth/AgentRegisterScreen';
import { SwitchAccountScreen } from '../../../packages/shared-mobile/src/features/profile/screens/SwitchAccountScreen';

// Onboarding — agent-specific KYC (name + language + ID card, no GST)
import { AgentKycScreen } from '../screens/onboarding/AgentKycScreen';
import { WorkCategorySelectScreen } from '../screens/onboarding/WorkCategorySelectScreen';
import { WorkerProfileCompletionScreen } from '../../../packages/shared-mobile/src/features/onboarding/screens/WorkerProfileCompletionScreen';

// Role-based tab navigator — handles agent / worker / selfworker
import { RoleTabsNavigator } from '../../../packages/shared-mobile/src/app/navigation/RoleTabsNavigator';

// Inner screens
import { EditProfileScreen } from '../../../packages/shared-mobile/src/features/profile/screens/EditProfileScreen';
import { WorkPreferencesScreen } from '../../../packages/shared-mobile/src/features/profile/screens/WorkPreferencesScreen';
import { CertificatesScreen } from '../../../packages/shared-mobile/src/features/profile/screens/CertificatesScreen';
import { KycVerificationScreen } from '../../../packages/shared-mobile/src/features/profile/screens/KycVerificationScreen';
import { WorkerKycReuploadScreen } from '../../../packages/shared-mobile/src/features/agent/screens/WorkerKycReuploadScreen';
import { NotificationPreferencesScreen } from '../../../packages/shared-mobile/src/features/profile/screens/NotificationPreferencesScreen';
import { NotificationsScreen } from '../../../packages/shared-mobile/src/features/profile/screens/NotificationsScreen';
import { MyActivityScreen } from '../../../packages/shared-mobile/src/features/profile/screens/MyActivityScreen';
import { SupportScreen } from '../../../packages/shared-mobile/src/features/profile/screens/SupportScreen';
import { TermsPrivacyScreen } from '../../../packages/shared-mobile/src/features/profile/screens/TermsPrivacyScreen';
import { JobMarketplaceScreen } from '../../../packages/shared-mobile/src/features/jobs/screens/JobMarketplaceScreen';
import { JobMarketplaceDetailScreen } from '../../../packages/shared-mobile/src/features/jobs/screens/JobMarketplaceDetailScreen';
import { JobDetailScreen } from '../../../packages/shared-mobile/src/features/jobs/screens/JobDetailScreen';
import { MyApplicationsScreen } from '../../../packages/shared-mobile/src/features/jobs/screens/MyApplicationsScreen';
import { RequirementDetailScreen } from '../../../packages/shared-mobile/src/features/jobs/screens/RequirementDetailScreen';
import { WorkerProfileScreen } from '../../../packages/shared-mobile/src/features/search/screens/WorkerProfileScreen';
import { WorkerSearchScreen } from '../../../packages/shared-mobile/src/features/search/screens/WorkerSearchScreen';
import { AddWorkerScreen } from '../../../packages/shared-mobile/src/features/agent/screens/AddWorkerScreen';
import { AgentWorkersScreen } from '../../../packages/shared-mobile/src/features/agent/screens/AgentWorkersScreen';
import { MyPlacementsScreen } from '../../../packages/shared-mobile/src/features/agent/screens/MyPlacementsScreen';
import { ChatRoomScreen } from '../../../packages/shared-mobile/src/features/chat/screens/ChatRoomScreen';
import { SubscriptionScreen } from '../../../packages/shared-mobile/src/features/payment/screens/SubscriptionScreen';
import { PaymentWebViewScreen, TopupWebViewScreen } from '../../../packages/shared-mobile/src/features/payment/screens/PaymentWebViewScreen';
import { PdfViewerScreen } from '../../../packages/shared-mobile/src/features/profile/screens/PdfViewerScreen';
import { InvitationsScreen } from '../../../packages/shared-mobile/src/features/invitations/screens/InvitationsScreen';

import * as Notifications from 'expo-notifications';
import type { AgentStackParamList } from './types';
import type { AppRole } from '../../../packages/shared-mobile/src/shared/types/domain';

const Stack = createNativeStackNavigator<AgentStackParamList>();

// 'checking'     — reading AsyncStorage on first mount
// 'not_selected' — no saved language (first-time user)
// 'selected'     — language was saved; skip Welcome, open Login directly
type LangStatus = 'checking' | 'not_selected' | 'selected';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const AppNavigator = (): React.JSX.Element => {
  const { state, signOut } = useAuth();
  const { theme } = useAppTheme();
  const [langStatus, setLangStatus] = useState<LangStatus>('checking');
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  // Compute role early — must be before any useEffect that references agentAppRole
  // (declaring it after an early return causes a TDZ crash on Android)
  const userRole = (state.session?.user.role ?? '').toLowerCase() as AppRole;
  const agentAppRole: AppRole =
    userRole === 'agent' || userRole === 'worker' || userRole === 'selfworker'
      ? userRole
      : 'worker';

  // Sync DB language ↔ local storage on every login
  useLangSync(AGENT_LANG_KEY);

  // Load saved language from AsyncStorage on app boot
  useEffect(() => {
    AsyncStorage.getItem(AGENT_LANG_KEY).then((saved) => {
      if (saved) {
        void i18n.changeLanguage(saved);
        setLangStatus('selected');
      } else {
        setLangStatus('not_selected');
      }
    });
  }, []);

  // ── Notification listeners ────────────────────────────────────────────────
  useEffect(() => {
    // Fired when a notification arrives while app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener((_notification) => {
      // Notification banner is shown automatically via setNotificationHandler above.
      // Additional in-app handling (e.g. badge update) can go here.
    });

    // Fired when user taps a notification (foreground, background, or killed)
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      // Deep link based on notification type
      if (!navigationRef.isReady()) return;
      const type = data?.type as string | undefined;
      if (type === 'requirement' && data?.requirementId) {
        navigationRef.navigate('RequirementDetail', { requirementId: data.requirementId as string });
      } else if (type === 'workerInvite') {
        navigationRef.navigate('Invitations', undefined);
      } else if (type === 'chat' && data?.roomId) {
        navigationRef.navigate('ChatRoom', { roomId: data.roomId as string, roomName: (data.roomName as string) ?? 'Chat' });
      } else if (type === 'kyc') {
        // KYC update: a worker-scoped notice (data.workerId) deep-links to that
        // worker's re-upload screen; otherwise it's the agent's own KYC.
        if (data?.status === 'Rejected' && data?.workerId) {
          navigationRef.navigate('WorkerKycReupload', {
            workerId: data.workerId as string,
            workerName: data.workerName as string | undefined,
            reason: data.reason as string | undefined,
          });
        } else {
          navigationRef.navigate('KycVerification', undefined);
        }
      } else {
        navigationRef.navigate('Notifications', undefined);
      }
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  // Show profile completion screen ONCE after fresh registration for
  // SelfWorker/Worker/Agent. After the user has seen it (complete), never show
  // again — onboardingCompleted + the per-user "seen" flag guard re-triggers.
  useEffect(() => {
    if (
      state.status !== 'authenticated' ||
      (agentAppRole !== 'selfworker' && agentAppRole !== 'worker' && agentAppRole !== 'agent')
    ) return;

    const userId = state.session?.user?.id ?? '';
    if (!userId) return;
    const seenKey = `workerProfileFlowSeen_${userId}`;

    // onboardingCompleted is false only right after fresh registration
    if (!state.session?.onboardingCompleted) {
      // Mark as seen immediately so skip/back never re-triggers
      void AsyncStorage.setItem(seenKey, 'true');
      const timer = setTimeout(() => {
        if (navigationRef.isReady()) {
          navigationRef.reset({ index: 0, routes: [{ name: 'WorkerProfileCompletion' as never }] });
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [state.status, state.session?.onboardingCompleted, state.session?.user?.id, agentAppRole]);

  useEffect(() => {
    if (state.status === 'unauthenticated') {
      // When language hasn't been selected yet, LanguageSelect is already the initial screen —
      // no need for an imperative reset. When language is selected, Login is the initial screen
      // via conditional rendering — resetToWelcome would incorrectly push Welcome on top.
      // Only call resetToWelcome during app session when auth changes mid-session (edge-case fallback).
      if (langStatus === 'checking') return undefined;
      return undefined;
    }
    // If a non-agent/worker/selfworker session is stored (e.g. stale Employer session), sign out.
    if (state.status === 'authenticated') {
      const role = (state.session?.user.role ?? '').toLowerCase();
      if (role !== 'agent' && role !== 'worker' && role !== 'selfworker') {
        signOut();
      }
    }
    return undefined;
  }, [state.status, state.session?.user.role, signOut, langStatus]);

  const navigationTheme = useMemo(
    () => ({
      ...(theme.mode === 'dark' ? NavigationDarkTheme : NavigationDefaultTheme),
      colors: {
        ...(theme.mode === 'dark' ? NavigationDarkTheme.colors : NavigationDefaultTheme.colors),
        primary: theme.colors.primary,
        background: theme.colors.background,
        card: theme.colors.surface,
        text: theme.colors.text,
        border: theme.colors.border,
        notification: theme.colors.secondary,
      },
    }),
    [theme]
  );

  if (state.status === 'loading' || langStatus === 'checking') {
    return <LoadingState fullscreen message="Preparing your workspace…" />;
  }

  return (
    <NavigationContainer ref={navigationRef} theme={navigationTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        {state.status === 'unauthenticated' ? (
          // ── Auth screens ──────────────────────────────────────────
          <>
            {langStatus === 'not_selected' ? (
              // First-time launch: language picker → intent (role) choice → Welcome → Login
              <>
                <Stack.Screen name="LanguageSelect" component={LanguageSelectScreen} options={{ animation: 'fade' }} />
                <Stack.Screen name="IntentSelect" component={IntentSelectScreen} options={{ animation: 'fade' }} />
                <Stack.Screen name="Welcome" component={AgentWelcomeScreen} />
                <Stack.Screen name="Login" component={AgentLoginScreen} />
              </>
            ) : (
              // Returning user: open Login directly, skipping the Welcome/landing page
              <>
                <Stack.Screen name="Login" component={AgentLoginScreen} options={{ animation: 'fade' }} />
                <Stack.Screen name="Welcome" component={AgentWelcomeScreen} />
              </>
            )}
            <Stack.Screen name="OtpVerification" component={OtpVerificationScreen} />
            <Stack.Screen name="Register" component={AgentRegisterScreen} />
            <Stack.Screen name="RegisterOtp" component={RegisterOtpScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          </>
        ) : (
          // ── Authenticated ─────────────────────────────────────────
          <>
            <Stack.Screen name="Main" options={{ animation: 'none' }}>
              {() => <RoleTabsNavigator role={agentAppRole} />}
            </Stack.Screen>
            <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="WorkPreferences" component={WorkPreferencesScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="JobMarketplace" component={JobMarketplaceScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="JobMarketplaceDetail" component={JobMarketplaceDetailScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="JobDetail" component={JobDetailScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="MyApplications" component={MyApplicationsScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="RequirementDetail" component={RequirementDetailScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="WorkerProfile" component={WorkerProfileScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="WorkerSearch" component={WorkerSearchScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="AddWorker" component={AddWorkerScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="AgentWorkers" component={AgentWorkersScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="MyPlacements" component={MyPlacementsScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="WorkCategorySelect" component={WorkCategorySelectScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="Kyc" component={AgentKycScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="WorkerProfileCompletion" component={WorkerProfileCompletionScreen} options={{ animation: 'slide_from_bottom', headerShown: false }} />
            <Stack.Screen name="Certificates" component={CertificatesScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="KycVerification" component={KycVerificationScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="NotificationPreferences" component={NotificationPreferencesScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="MyActivity" component={MyActivityScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="Support" component={SupportScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="TermsPrivacy" component={TermsPrivacyScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="Subscription" component={SubscriptionScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="PaymentWebView" component={PaymentWebViewScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="TopupWebView" component={TopupWebViewScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="SwitchAccount" component={SwitchAccountScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="PdfViewer" component={PdfViewerScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="Invitations" component={InvitationsScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen
              name="ChatRoom"
              options={{
                animation: 'slide_from_right',
                headerShown: false,
              }}
            >
              {({ route }) => (
                <ChatRoomScreen
                  roomId={route.params.roomId}
                  roomName={route.params.roomName}
                  roomAvatar={route.params.roomAvatar}
                />
              )}
            </Stack.Screen>
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
