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

// Auth screens (shared)
import { WelcomeScreen } from '../../../packages/shared-mobile/src/features/auth/screens/WelcomeScreen';
import { LoginScreen } from '../../../packages/shared-mobile/src/features/auth/screens/LoginScreen';
import { OtpVerificationScreen } from '../../../packages/shared-mobile/src/features/auth/screens/OtpVerificationScreen';
import { RegisterOtpScreen } from '../../../packages/shared-mobile/src/features/auth/screens/RegisterOtpScreen';
import { ForgotPasswordScreen } from '../../../packages/shared-mobile/src/features/auth/screens/ForgotPasswordScreen';

// Employer-specific register screen
import { EmployerRegisterScreen } from '../screens/auth/EmployerRegisterScreen';

// Onboarding — employer-specific KYC with GST collection
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
import { TransactionScreen } from '../../../packages/shared-mobile/src/features/wallet/screens/TransactionScreen';
import { PaymentWebViewScreen, TopupWebViewScreen } from '../../../packages/shared-mobile/src/features/payment/screens/PaymentWebViewScreen';
import { PipelineScreen } from '../../../packages/shared-mobile/src/features/employer/screens/PipelineScreen';
import { PdfViewerScreen } from '../../../packages/shared-mobile/src/features/profile/screens/PdfViewerScreen';

import type { EmployerStackParamList } from './types';

const Stack = createNativeStackNavigator<EmployerStackParamList>();

export const AppNavigator = (): React.JSX.Element => {
  const { state, signOut } = useAuth();
  const { theme } = useAppTheme();

  useEffect(() => {
    if (state.status === 'unauthenticated') {
      const handle = setTimeout(() => { resetToWelcome(); }, 50);
      return () => clearTimeout(handle);
    }
    // If somehow a non-employer session is stored (e.g. stale Agent session),
    // sign out so the user can log in with their employer account.
    if (state.status === 'authenticated' && (state.session?.user.role ?? '').toLowerCase() !== 'employer') {
      signOut();
    }
    return undefined;
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

  if (state.status === 'loading') {
    return <LoadingState message="Preparing your workspace…" />;
  }

  return (
    <NavigationContainer ref={navigationRef} theme={navigationTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        {state.status === 'unauthenticated' ? (
          // ── Auth screens ──────────────────────────────────────────
          <>
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
            <Stack.Screen name="Login" component={LoginScreen} initialParams={{ roleHint: 'employer' }} />
            <Stack.Screen name="OtpVerification" component={OtpVerificationScreen} />
            <Stack.Screen name="Register" component={EmployerRegisterScreen} />
            <Stack.Screen name="RegisterOtp" component={RegisterOtpScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} initialParams={{ roleHint: 'employer' }} />
          </>
        ) : !state.session?.onboardingCompleted ? (
          // ── Onboarding — just KYC, no role selection ─────────────
          <>
            <Stack.Screen name="Kyc" component={EmployerKycScreen} />
          </>
        ) : (
          // ── Authenticated ─────────────────────────────────────────
          <>
            <Stack.Screen name="Main" options={{ animation: 'none' }}>
              {() => <RoleTabsNavigator role="employer" />}
            </Stack.Screen>
            <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="PostRequirement" component={PostRequirementScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="RequirementDetail" component={RequirementDetailScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="WorkerProfile" component={WorkerProfileScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="WorkerSearch" component={WorkerSearchScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="KycVerification" component={KycVerificationScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="NotificationPreferences" component={NotificationPreferencesScreen} initialParams={{ appType: 'employer' }} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="MyActivity" component={MyActivityScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="Support" component={SupportScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="TermsPrivacy" component={TermsPrivacyScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="Transactions" component={TransactionScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="Subscription" component={SubscriptionScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="PaymentWebView" component={PaymentWebViewScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="TopupWebView" component={TopupWebViewScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="EmployerPipeline" component={PipelineScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="PdfViewer" component={PdfViewerScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
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
