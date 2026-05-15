import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { KycScreen } from '../../features/onboarding/screens/KycScreen';
import { RoleSelectionScreen } from '../../features/onboarding/screens/RoleSelectionScreen';
import { ROUTES } from '../../shared/constants/routes';
import type { OnboardingStackParamList } from './types';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export const OnboardingNavigator = (): React.JSX.Element => (
  <Stack.Navigator
    screenOptions={{
      headerTitleAlign: 'center',
    }}
  >
    <Stack.Screen
      name={ROUTES.ONBOARDING.ROLE_SELECTION}
      component={RoleSelectionScreen}
      options={{ title: 'Role setup' }}
    />
    <Stack.Screen name={ROUTES.ONBOARDING.KYC} component={KycScreen} options={{ title: 'KYC' }} />
  </Stack.Navigator>
);
