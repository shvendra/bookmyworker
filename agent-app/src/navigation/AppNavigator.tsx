import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationDefaultTheme,
  NavigationContainer,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect, useMemo } from 'react';

import { useAppTheme } from '../../../packages/shared-mobile/src/core/theme';
import { useAuth } from '../../../packages/shared-mobile/src/state/auth/AuthContext';
import { LoadingState } from '../../../packages/shared-mobile/src/shared/components/feedback/LoadingState';
import { navigationRef, resetToWelcome } from '../../../packages/shared-mobile/src/core/navigation/navigationRef';

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

// Role-based tab navigator — handles agent / worker / selfworker
import { RoleTabsNavigator } from '../../../packages/shared-mobile/src/app/navigation/RoleTabsNavigator';

// Inner screens
import { EditProfileScreen } from '../../../packages/shared-mobile/src/features/profile/screens/EditProfileScreen';
import { KycVerificationScreen } from '../../../packages/shared-mobile/src/features/profile/screens/KycVerificationScreen';
import { NotificationPreferencesScreen } from '../../../packages/shared-mobile/src/features/profile/screens/NotificationPreferencesScreen';
import { NotificationsScreen } from '../../../packages/shared-mobile/src/features/profile/screens/NotificationsScreen';
import { MyActivityScreen } from '../../../packages/shared-mobile/src/features/profile/screens/MyActivityScreen';
import { SupportScreen } from '../../../packages/shared-mobile/src/features/profile/screens/SupportScreen';
import { TermsPrivacyScreen } from '../../../packages/shared-mobile/src/features/profile/screens/TermsPrivacyScreen';
import { JobMarketplaceScreen } from '../../../packages/shared-mobile/src/features/jobs/screens/JobMarketplaceScreen';
import { JobDetailScreen } from '../../../packages/shared-mobile/src/features/jobs/screens/JobDetailScreen';
import { MyApplicationsScreen } from '../../../packages/shared-mobile/src/features/jobs/screens/MyApplicationsScreen';
import { RequirementDetailScreen } from '../../../packages/shared-mobile/src/features/jobs/screens/RequirementDetailScreen';
import { WorkerProfileScreen } from '../../../packages/shared-mobile/src/features/search/screens/WorkerProfileScreen';
import { WorkerSearchScreen } from '../../../packages/shared-mobile/src/features/search/screens/WorkerSearchScreen';
import { AddWorkerScreen } from '../../../packages/shared-mobile/src/features/agent/screens/AddWorkerScreen';
import { AgentWorkersScreen } from '../../../packages/shared-mobile/src/features/agent/screens/AgentWorkersScreen';
import { ChatRoomScreen } from '../../../packages/shared-mobile/src/features/chat/screens/ChatRoomScreen';
import { SubscriptionScreen } from '../../../packages/shared-mobile/src/features/payment/screens/SubscriptionScreen';
import { PaymentWebViewScreen, TopupWebViewScreen } from '../../../packages/shared-mobile/src/features/payment/screens/PaymentWebViewScreen';

import type { AgentStackParamList } from './types';

const Stack = createNativeStackNavigator<AgentStackParamList>();

export const AppNavigator = (): React.JSX.Element => {
  const { state } = useAuth();
  const { theme } = useAppTheme();

  useEffect(() => {
    if (state.status === 'unauthenticated') {
      const handle = setTimeout(() => { resetToWelcome(); }, 50);
      return () => clearTimeout(handle);
    }
    return undefined;
  }, [state.status]);

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

  if (state.status === 'loading') {
    return <LoadingState message="Preparing your workspace…" />;
  }

  // Only allow agent / worker / selfworker roles in this app
  const userRole = state.session?.user.role;
  const agentAppRole =
    userRole === 'agent' || userRole === 'worker' || userRole === 'selfworker'
      ? userRole
      : 'worker';

  return (
    <NavigationContainer ref={navigationRef} theme={navigationTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        {state.status === 'unauthenticated' ? (
          // ── Auth screens ──────────────────────────────────────────
          <>
            <Stack.Screen name="Welcome" component={AgentWelcomeScreen} />
            <Stack.Screen name="Login" component={AgentLoginScreen} />
            <Stack.Screen name="OtpVerification" component={OtpVerificationScreen} />
            <Stack.Screen name="Register" component={AgentRegisterScreen} />
            <Stack.Screen name="RegisterOtp" component={RegisterOtpScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          </>
        ) : !state.session?.onboardingCompleted ? (
          // ── Onboarding — KYC only ─────────────────────────────────
          <>
            <Stack.Screen name="Kyc" component={AgentKycScreen} />
          </>
        ) : (
          // ── Authenticated ─────────────────────────────────────────
          <>
            <Stack.Screen name="Main" options={{ animation: 'none' }}>
              {() => <RoleTabsNavigator role={agentAppRole} />}
            </Stack.Screen>
            <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="JobMarketplace" component={JobMarketplaceScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="JobDetail" component={JobDetailScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="MyApplications" component={MyApplicationsScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="RequirementDetail" component={RequirementDetailScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="WorkerProfile" component={WorkerProfileScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="WorkerSearch" component={WorkerSearchScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="AddWorker" component={AddWorkerScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="AgentWorkers" component={AgentWorkersScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="Kyc" component={AgentKycScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
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
