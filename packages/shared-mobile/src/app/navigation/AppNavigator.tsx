import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationDefaultTheme,
  NavigationContainer,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect, useMemo } from 'react';
import { useAppTheme } from '../../core/theme';
import { useAuth } from '../../state/auth/AuthContext';
import { LoadingState } from '../../shared/components/feedback/LoadingState';
import { navigationRef, resetToWelcome } from '../../core/navigation/navigationRef';

// Auth screens
import { WelcomeScreen } from '../../features/auth/screens/WelcomeScreen';
import { LoginScreen } from '../../features/auth/screens/LoginScreen';
import { OtpVerificationScreen } from '../../features/auth/screens/OtpVerificationScreen';
import { RegisterScreen } from '../../features/auth/screens/RegisterScreen';
import { RegisterOtpScreen } from '../../features/auth/screens/RegisterOtpScreen';
import { ForgotPasswordScreen } from '../../features/auth/screens/ForgotPasswordScreen';

// Onboarding screens
import { RoleSelectionScreen } from '../../features/onboarding/screens/RoleSelectionScreen';
import { KycScreen } from '../../features/onboarding/screens/KycScreen';

// Main tabs
import { RoleTabsNavigator } from './RoleTabsNavigator';

// Inner stack screens
import { EditProfileScreen } from '../../features/profile/screens/EditProfileScreen';
import { KycVerificationScreen } from '../../features/profile/screens/KycVerificationScreen';
import { NotificationPreferencesScreen } from '../../features/profile/screens/NotificationPreferencesScreen';
import { NotificationsScreen } from '../../features/profile/screens/NotificationsScreen';
import { SupportScreen } from '../../features/profile/screens/SupportScreen';
import { SwitchAccountScreen } from '../../features/profile/screens/SwitchAccountScreen';
import { TermsPrivacyScreen } from '../../features/profile/screens/TermsPrivacyScreen';
import { JobMarketplaceScreen } from '../../features/jobs/screens/JobMarketplaceScreen';
import { JobDetailScreen } from '../../features/jobs/screens/JobDetailScreen';
import { MyApplicationsScreen } from '../../features/jobs/screens/MyApplicationsScreen';
import { RequirementDetailScreen } from '../../features/jobs/screens/RequirementDetailScreen';
import { PostRequirementScreen } from '../../features/jobs/screens/PostRequirementScreen';
import { WorkerProfileScreen } from '../../features/search/screens/WorkerProfileScreen';
import { AddWorkerScreen } from '../../features/agent/screens/AddWorkerScreen';
import { WorkerSearchScreen } from '../../features/search/screens/WorkerSearchScreen';
import { ChatRoomScreen } from '../../features/chat/screens/ChatRoomScreen';

import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator = (): React.JSX.Element => {
  const { state } = useAuth();
  const { theme } = useAppTheme();

  // When auth state becomes unauthenticated, forcibly reset the navigation stack
  // to Welcome. We wait one frame (via setTimeout) so the conditional screen list
  // in this Navigator has already committed with the auth screens before we dispatch.
  // Without the delay, Welcome doesn't exist in the navigator yet and the reset silently fails.
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

  return (
    <NavigationContainer ref={navigationRef} theme={navigationTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        {state.status === 'unauthenticated' ? (
          // ── Auth screens ──────────────────────────────────────────
          <>
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="OtpVerification" component={OtpVerificationScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="RegisterOtp" component={RegisterOtpScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          </>
        ) : !state.session?.onboardingCompleted ? (
          // ── Onboarding screens ────────────────────────────────────
          <>
            <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
            <Stack.Screen name="Kyc" component={KycScreen} />
          </>
        ) : (
          // ── Authenticated: tabs + inner screens in one flat stack ─
          <>
            <Stack.Screen name="Main" options={{ animation: 'none' }}>
              {() => <RoleTabsNavigator role={state.session?.user.role ?? 'worker'} />}
            </Stack.Screen>
            <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="JobMarketplace" component={JobMarketplaceScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="JobDetail" component={JobDetailScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="MyApplications" component={MyApplicationsScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="RequirementDetail" component={RequirementDetailScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="WorkerProfile" component={WorkerProfileScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="PostRequirement" component={PostRequirementScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="AddWorker" component={AddWorkerScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="WorkerSearch" component={WorkerSearchScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="KycVerification" component={KycVerificationScreen} options={{ animation: 'slide_from_right', headerShown: true, title: 'KYC Verification' }} />
            <Stack.Screen name="NotificationPreferences" component={NotificationPreferencesScreen} options={{ animation: 'slide_from_right', headerShown: true, title: 'Notification Preferences' }} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ animation: 'slide_from_right', headerShown: true, title: 'Notifications' }} />
            <Stack.Screen name="Support" component={SupportScreen} options={{ animation: 'slide_from_right', headerShown: true, title: 'Support & Help' }} />
            <Stack.Screen name="TermsPrivacy" component={TermsPrivacyScreen} options={{ animation: 'slide_from_right', headerShown: true, title: 'Terms & Privacy' }} />
            <Stack.Screen name="SwitchAccount" component={SwitchAccountScreen} options={{ animation: 'slide_from_right', headerShown: true, title: 'Switch Account' }} />
            <Stack.Screen
              name="ChatRoom"
              options={({ route }) => ({ animation: 'slide_from_right', headerShown: true, title: route.params.roomName })}
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

