import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { ROUTES } from '../../shared/constants/routes';
import { LoginScreen } from '../../features/auth/screens/LoginScreen';
import { OtpVerificationScreen } from '../../features/auth/screens/OtpVerificationScreen';
import { WelcomeScreen } from '../../features/auth/screens/WelcomeScreen';
import { RegisterScreen } from '../../features/auth/screens/RegisterScreen';
import { RegisterOtpScreen } from '../../features/auth/screens/RegisterOtpScreen';
import type { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export const AuthNavigator = (): React.JSX.Element => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name={ROUTES.AUTH.WELCOME} component={WelcomeScreen} />
    <Stack.Screen name={ROUTES.AUTH.LOGIN} component={LoginScreen} />
    <Stack.Screen name={ROUTES.AUTH.OTP_VERIFICATION} component={OtpVerificationScreen} />
    <Stack.Screen name={ROUTES.AUTH.REGISTER} component={RegisterScreen} />
    <Stack.Screen name={ROUTES.AUTH.REGISTER_OTP} component={RegisterOtpScreen} />
  </Stack.Navigator>
);
