import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationDefaultTheme,
  NavigationContainer,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useRef } from 'react';
import Constants from 'expo-constants';
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
import { MyActivityScreen } from '../../features/profile/screens/MyActivityScreen';
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
import { SubscriptionScreen } from '../../features/payment/screens/SubscriptionScreen';
import { ShortlistScreen } from '../../features/employer/screens/ShortlistScreen';
import { PipelineScreen } from '../../features/employer/screens/PipelineScreen';
import { PaymentWebViewScreen, TopupWebViewScreen } from '../../features/payment/screens/PaymentWebViewScreen';

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

  // ── Push notification listeners (foreground + tap deep-link) ──────────────
  const notifReceivedSub = useRef<{ remove: () => void } | null>(null);
  const notifResponseSub = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    if (state.status !== 'authenticated') return;
    const isExpoGo = Constants.appOwnership === 'expo';
    if (isExpoGo) return;

    void (async () => {
      const Notifications = await import('expo-notifications');

      // Foreground: show alert + sound when app is open
      await Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });

      // Foreground received: invalidate notifications query so hub badge updates
      notifReceivedSub.current = Notifications.addNotificationReceivedListener(() => {
        // Badge refresh is handled by React Query polling on NotificationsScreen
        // Nothing additional needed here
      });

      // Tap handler: user taps a push notification (background or quit state)
      notifResponseSub.current = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = (response.notification.request.content.data ?? {}) as Record<string, unknown>;
        const type = (data.type as string | undefined) ?? 'system';

        // Wait for nav container to be ready
        const navigate = (): void => {
          if (!navigationRef.isReady()) {
            setTimeout(navigate, 150);
            return;
          }
          switch (type) {
            case 'newWorker':
              navigationRef.navigate('WorkerSearch' as never);
              break;
            case 'kyc':
              navigationRef.navigate('KycVerification' as never);
              break;
            case 'requirement':
            case 'interest': {
              const reqId = data.requirementId as string | undefined;
              if (reqId) {
                navigationRef.navigate('RequirementDetail' as never, { requirementId: reqId } as never);
              } else {
                navigationRef.navigate('Notifications' as never);
              }
              break;
            }
            default:
              navigationRef.navigate('Notifications' as never);
          }
        };
        navigate();
      });
    })();

    return () => {
      notifReceivedSub.current?.remove();
      notifResponseSub.current?.remove();
    };
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
            <Stack.Screen name="KycVerification" component={KycVerificationScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="NotificationPreferences" component={NotificationPreferencesScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="MyActivity" component={MyActivityScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="Support" component={SupportScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="TermsPrivacy" component={TermsPrivacyScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="SwitchAccount" component={SwitchAccountScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="Subscription" component={SubscriptionScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="PaymentWebView" component={PaymentWebViewScreen} options={{ animation: 'slide_from_bottom', headerShown: false, presentation: 'modal' }} />
            <Stack.Screen name="TopupWebView" component={TopupWebViewScreen} options={{ animation: 'slide_from_bottom', headerShown: false, presentation: 'modal' }} />
            <Stack.Screen name="Shortlist" component={ShortlistScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="EmployerPipeline" component={PipelineScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
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

