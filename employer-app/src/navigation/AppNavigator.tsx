import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationDefaultTheme,
  NavigationContainer,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useMemo, useState } from 'react';
import * as Notifications from 'expo-notifications';
import type { Subscription } from 'expo-notifications';

import i18n from '../../../packages/shared-mobile/src/core/i18n';
import { useAppTheme } from '../../../packages/shared-mobile/src/core/theme';
import { useAuth } from '../../../packages/shared-mobile/src/state/auth/AuthContext';
import { LoadingState } from '../../../packages/shared-mobile/src/shared/components/feedback/LoadingState';
import { navigationRef } from '../../../packages/shared-mobile/src/core/navigation/navigationRef';

// Language selection — shown only on very first launch
import { EMPLOYER_LANG_KEY, LanguageSelectScreen } from '../screens/language/LanguageSelectScreen';
import { useLangSync } from '../../../packages/shared-mobile/src/core/i18n/useLangSync';

// Auth screens (shared)
import { WelcomeScreen } from '../../../packages/shared-mobile/src/features/auth/screens/WelcomeScreen';
import { LoginScreen } from '../../../packages/shared-mobile/src/features/auth/screens/LoginScreen';
import { OtpVerificationScreen } from '../../../packages/shared-mobile/src/features/auth/screens/OtpVerificationScreen';
import { RegisterOtpScreen } from '../../../packages/shared-mobile/src/features/auth/screens/RegisterOtpScreen';
import { ForgotPasswordScreen } from '../../../packages/shared-mobile/src/features/auth/screens/ForgotPasswordScreen';

// Employer-specific register screen
import { EmployerRegisterScreen } from '../screens/auth/EmployerRegisterScreen';

// Onboarding — employer-specific KYC/details (language + GST/ID) shown after fresh registration
import { EmployerKycScreen } from '../../../packages/shared-mobile/src/features/onboarding/screens/EmployerKycScreen';

// Employer tabs (employer role only)
import { RoleTabsNavigator } from '../../../packages/shared-mobile/src/app/navigation/RoleTabsNavigator';

// Inner screens
import { EditProfileScreen } from '../../../packages/shared-mobile/src/features/profile/screens/EditProfileScreen';
import { KycVerificationScreen } from '../../../packages/shared-mobile/src/features/profile/screens/KycVerificationScreen';
import { NotificationPreferencesScreen } from '../../../packages/shared-mobile/src/features/profile/screens/NotificationPreferencesScreen';
import { NotificationsScreen } from '../../../packages/shared-mobile/src/features/profile/screens/NotificationsScreen';
import { MyActivityScreen } from '../../../packages/shared-mobile/src/features/profile/screens/MyActivityScreen';
import { SupportScreen } from '../../../packages/shared-mobile/src/features/profile/screens/SupportScreen';
import { TermsPrivacyScreen } from '../../../packages/shared-mobile/src/features/profile/screens/TermsPrivacyScreen';
import { PostRequirementScreen } from '../../../packages/shared-mobile/src/features/jobs/screens/PostRequirementScreen';
import { RequirementDetailScreen } from '../../../packages/shared-mobile/src/features/jobs/screens/RequirementDetailScreen';
import { WorkerProfileScreen } from '../../../packages/shared-mobile/src/features/search/screens/WorkerProfileScreen';
import { WorkerSearchScreen } from '../../../packages/shared-mobile/src/features/search/screens/WorkerSearchScreen';
import { ChatRoomScreen } from '../../../packages/shared-mobile/src/features/chat/screens/ChatRoomScreen';
import { SubscriptionScreen } from '../../../packages/shared-mobile/src/features/payment/screens/SubscriptionScreen';
import { EmployerBenefitsScreen } from '../../../packages/shared-mobile/src/features/payment/screens/EmployerBenefitsScreen';
import { TransactionScreen } from '../../../packages/shared-mobile/src/features/wallet/screens/TransactionScreen';
import { PaymentWebViewScreen, TopupWebViewScreen } from '../../../packages/shared-mobile/src/features/payment/screens/PaymentWebViewScreen';
import { PipelineScreen } from '../../../packages/shared-mobile/src/features/employer/screens/PipelineScreen';
import { EmployerAttendanceScreen } from '../../../packages/shared-mobile/src/features/employer/screens/EmployerAttendanceScreen';
import { EmployerAnalyticsScreen } from '../../../packages/shared-mobile/src/features/employer/screens/EmployerAnalyticsScreen';
import { EmployerAgreementScreen } from '../../../packages/shared-mobile/src/features/employer/screens/EmployerAgreementScreen';
import { RequirementCalendarScreen } from '../../../packages/shared-mobile/src/features/employer/screens/RequirementCalendarScreen';
import { CallHistoryScreen } from '../../../packages/shared-mobile/src/features/employer/screens/CallHistoryScreen';
import { ViewedContactsScreen } from '../../../packages/shared-mobile/src/features/employer/screens/ViewedContactsScreen';
import { DocumentHubScreen } from '../../../packages/shared-mobile/src/features/employer/screens/DocumentHubScreen';
import { PdfViewerScreen } from '../../../packages/shared-mobile/src/features/profile/screens/PdfViewerScreen';
import { RequirementInvitationsScreen } from '../../../packages/shared-mobile/src/features/employer/screens/RequirementInvitationsScreen';

import type { EmployerStackParamList } from './types';

const Stack = createNativeStackNavigator<EmployerStackParamList>();

// 'checking'     — reading AsyncStorage on first mount
// 'not_selected' — no saved language (first-time user)
// 'selected'     — language was saved; skip Welcome, open Login directly
type LangStatus = 'checking' | 'not_selected' | 'selected';

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
  const notificationListener = useRef<Subscription | null>(null);
  const responseListener      = useRef<Subscription | null>(null);

  // Sync DB language ↔ local storage on every login
  useLangSync(EMPLOYER_LANG_KEY);

  // Load saved language from AsyncStorage on app boot
  useEffect(() => {
    AsyncStorage.getItem(EMPLOYER_LANG_KEY).then((saved) => {
      if (saved) {
        void i18n.changeLanguage(saved);
        setLangStatus('selected');
      } else {
        setLangStatus('not_selected');
      }
    });
  }, []);

  // Notification deep-link handling
  useEffect(() => {
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      if (!navigationRef.isReady()) return;
      const type = data?.type as string | undefined;
      if (type === 'workerInviteResponse' && data?.requirementId) {
        navigationRef.navigate('RequirementInvitations', {
          requirementId: data.requirementId as string,
          requirementTitle: data.workType as string | undefined,
        });
      } else if (type === 'requirement' && data?.requirementId) {
        navigationRef.navigate('RequirementDetail', { requirementId: data.requirementId as string });
      } else {
        navigationRef.navigate('Notifications', undefined);
      }
    });
    return () => { responseListener.current?.remove(); };
  }, []);

  useEffect(() => {
    // If somehow a non-employer session is stored (e.g. stale Agent session),
    // sign out so the user can log in with their employer account.
    if (state.status === 'authenticated' && (state.session?.user.role ?? '').toLowerCase() !== 'employer') {
      signOut();
    }
  }, [state.status, state.session?.user.role, signOut]);

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
              // First-time launch: language picker → Welcome landing → Login
              <>
                <Stack.Screen name="LanguageSelect" component={LanguageSelectScreen} options={{ animation: 'fade' }} />
                <Stack.Screen name="Welcome" component={WelcomeScreen} />
                <Stack.Screen name="Login" component={LoginScreen} initialParams={{ roleHint: 'employer', appContext: 'employer-app' }} />
              </>
            ) : (
              // Returning user: open Login directly, Welcome still accessible via back
              <>
                <Stack.Screen name="Login" component={LoginScreen} initialParams={{ roleHint: 'employer', appContext: 'employer-app' }} options={{ animation: 'fade' }} />
                <Stack.Screen name="Welcome" component={WelcomeScreen} />
              </>
            )}
            <Stack.Screen name="OtpVerification" component={OtpVerificationScreen} />
            <Stack.Screen name="Register" component={EmployerRegisterScreen} />
            <Stack.Screen name="RegisterOtp" component={RegisterOtpScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} initialParams={{ roleHint: 'employer' }} />
          </>
        ) : (
          // ── Authenticated ─────────────────────────────────────────
          <>
            {/* When onboarding is incomplete (fresh registration), show Kyc first so
                the employer fills in language / GST / ID details before seeing the dashboard.
                Pattern mirrors agent-app: first screen in stack = initial route. */}
            {!state.session?.onboardingCompleted && (
              <Stack.Screen name="Kyc" component={EmployerKycScreen} options={{ animation: 'fade', headerShown: false }} />
            )}
            <Stack.Screen name="Main" options={{ animation: 'none' }}>
              {() => <RoleTabsNavigator role="employer" />}
            </Stack.Screen>
            <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="PostRequirement" component={PostRequirementScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="RequirementDetail" component={RequirementDetailScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="WorkerProfile" component={WorkerProfileScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="WorkerSearch" component={WorkerSearchScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="KycVerification" component={KycVerificationScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            {/* Kyc screen also accessible when onboarding is done (e.g. from Profile) */}
            {state.session?.onboardingCompleted && (
              <Stack.Screen name="Kyc" component={EmployerKycScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            )}
            <Stack.Screen name="NotificationPreferences" component={NotificationPreferencesScreen} initialParams={{ appType: 'employer' }} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="MyActivity" component={MyActivityScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="Support" component={SupportScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="TermsPrivacy" component={TermsPrivacyScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="Transactions" component={TransactionScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            {/* All upgrade/subscribe buttons navigate to 'Subscription' — now the CRM-style
                Plan Benefits / tier-upgrade page. The old pricing screen is kept on 'PlanPricing'
                (still reachable for contact top-ups). */}
            <Stack.Screen name="Subscription" component={EmployerBenefitsScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="PlanPricing" component={SubscriptionScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="PaymentWebView" component={PaymentWebViewScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="TopupWebView" component={TopupWebViewScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="EmployerPipeline" component={PipelineScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="EmployerAttendance" component={EmployerAttendanceScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="EmployerAnalytics" component={EmployerAnalyticsScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="EmployerAgreement" component={EmployerAgreementScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="RequirementCalendar" component={RequirementCalendarScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="CallHistory" component={CallHistoryScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="ViewedContacts" component={ViewedContactsScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="DocumentHub" component={DocumentHubScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="PdfViewer" component={PdfViewerScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="RequirementInvitations" component={RequirementInvitationsScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen
              name="ChatRoom"
              options={{ animation: 'slide_from_right', headerShown: false }}
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
