import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useRef, useEffect, useState } from 'react';
import {
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '../../../shared/components/ui/AppText';
import { useAppTheme } from '../../../core/theme';
import { ROUTES } from '../../../shared/constants/routes';
import { OtpLoginForm } from './OtpLoginForm';
import { PasswordLoginForm } from './PasswordLoginForm';
import type { AuthStackParamList } from '../../../app/navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export const LoginScreen = ({ navigation, route }: Props): React.JSX.Element => {
  const roleHint = route.params?.roleHint;
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'otp' | 'password'>('otp');

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 9, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const isDark = theme.mode === 'dark';

  return (
    <View style={[styles.root, { backgroundColor: isDark ? theme.colors.background : '#F4F6FB' }]}>
      <StatusBar barStyle="light-content" backgroundColor="#1338B0" />

      {/* Brand strip */}
      <View style={[styles.brandStrip, { paddingTop: insets.top + 16 }]}>
        <View style={styles.brandContent}>
          <View style={styles.brandLogoWrap}>
            <Image source={require('../../../../assets/logo.png')} style={styles.brandLogoImg} resizeMode="contain" />
          </View>
          <View style={styles.brandTextWrap}>
            <AppText variant="heading" color="#FFFFFF" style={styles.brandName}>
              BookMyWorker
            </AppText>
            <AppText variant="caption" color="rgba(255,255,255,0.7)">
              India's workforce platform
            </AppText>
          </View>
        </View>
        <View style={[styles.deco, styles.deco1]} />
        <View style={[styles.deco, styles.deco2]} />
      </View>

      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.card,
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
              !isDark && styles.cardShadow,
            ]}
          >
            {/* Mode tabs */}
            <View style={[styles.modeTabs, { borderColor: theme.colors.border }]}>
              <TouchableOpacity
                onPress={() => setMode('otp')}
                style={[styles.modeTab, mode === 'otp' && { backgroundColor: theme.colors.primary }]}
                activeOpacity={0.8}
              >
                <AppText variant="labelSm" color={mode === 'otp' ? '#fff' : theme.colors.mutedText}>
                  OTP Login
                </AppText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setMode('password')}
                style={[styles.modeTab, mode === 'password' && { backgroundColor: theme.colors.primary }]}
                activeOpacity={0.8}
              >
                <AppText variant="labelSm" color={mode === 'password' ? '#fff' : theme.colors.mutedText}>
                  Password Login
                </AppText>
              </TouchableOpacity>
            </View>

            {/* Each form gets a unique key so React fully remounts when switching */}
            {mode === 'otp' ? (
              <OtpLoginForm key="otp" navigation={navigation} roleHint={roleHint} />
            ) : (
              <PasswordLoginForm key="password" navigation={navigation} roleHint={roleHint} />
            )}
          </Animated.View>

          {/* Register link */}
          <View style={styles.registerRow}>
            <AppText variant="body" color={theme.colors.mutedText}>
              New to BookMyWorker?{' '}
            </AppText>
            <Pressable onPress={() => navigation.navigate(ROUTES.AUTH.REGISTER)}>
              <AppText variant="body" color={theme.colors.primary} style={styles.registerLink}>
                Create account
              </AppText>
            </Pressable>
          </View>

          {/* Trust badges */}
          <View style={styles.trustRow}>
            {['🔒 Secure OTP', '⚡ Instant Access', '✅ Verified Platform'].map((item) => (
              <View key={item} style={[styles.trustBadge, { backgroundColor: theme.colors.primaryLight }]}>
                <AppText variant="micro" color={theme.colors.primary}>{item}</AppText>
              </View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },

  brandStrip: {
    backgroundColor: '#1338B0',
    paddingHorizontal: 24,
    paddingBottom: 32,
    overflow: 'hidden',
  },
  brandContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingBottom: 8,
  },
  brandLogoWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLogoImg: { width: 60, height: 60 },
  brandTextWrap:  { gap: 2 },
  brandName:      { lineHeight: 28 },

  deco:  { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)' },
  deco1: { width: 200, height: 200, top: -80,  right: -60 },
  deco2: { width: 120, height: 120, bottom: -30, right: 80 },

  kav:    { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },

  card: {
    borderRadius: 24,
    padding: 24,
    marginTop: 0,
  },
  cardShadow: {
    shadowColor: '#1B4FD8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 8,
  },

  modeTabs: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 20,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },

  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
    flexWrap: 'wrap',
  },
  registerLink: { fontWeight: '700' },

  trustRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 20,
  },
  trustBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
});
