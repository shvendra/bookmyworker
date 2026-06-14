import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useRef, useEffect, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AppText } from '../../../../packages/shared-mobile/src/shared/components/ui/AppText';
import { Trademark } from '../../../../packages/shared-mobile/src/shared/components/ui/Trademark';
import { useAppTheme } from '../../../../packages/shared-mobile/src/core/theme';
import { OtpLoginForm } from '../../../../packages/shared-mobile/src/features/auth/screens/OtpLoginForm';
import { PasswordLoginForm } from '../../../../packages/shared-mobile/src/features/auth/screens/PasswordLoginForm';
import { useAppConfig, formatStat } from '../../../../packages/shared-mobile/src/core/api/endpoints/appConfigApi';
import type { AgentStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AgentStackParamList, 'Login'>;

const { width: W } = Dimensions.get('window');
const BRAND  = '#1037A4';
const ORANGE = '#F97316';

export const AgentLoginScreen = ({ navigation, route }: Props): React.JSX.Element => {
  const roleHint = route?.params?.roleHint;
  const { t } = useTranslation();
  const { theme }  = useAppTheme();
  const insets     = useSafeAreaInsets();
  const { config } = useAppConfig();
const [mode, setMode] = useState<'otp' | 'password'>('password');
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 58, friction: 9, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const isDark = theme.mode === 'dark';

  const trustItems = [
    { icon: '👷', text: t('loginWorkersStat', { count: formatStat(config.stats.workerCount) }) },
    { icon: '⚡', text: t('loginTrustOtp') },
    { icon: '✅', text: t('loginTrustVerifiedJobs') },
    { icon: '💰', text: t('loginTrustDailyWages') },
  ];

  /* ─────────────────────────────────────────────────────────── */
  return (
    <View style={[styles.root, { backgroundColor: isDark ? theme.colors.background : '#F0F4FB' }]}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND} />

      {/* ════ HERO ════ */}
      <View style={[styles.hero, { paddingTop: insets.top + 12 }]}>
        {/* decorative circles */}
        <View style={[styles.circle, styles.c1]} />
        <View style={[styles.circle, styles.c2]} />
        <View style={[styles.circle, styles.c3]} />
        <View style={styles.orangeBar} />

        {/* brand row: logo + name */}
        <View style={styles.brandRow}>
          <View style={styles.logoBox}>
            <Image
              source={require('../../../../packages/shared-mobile/assets/logo.png')}
              style={styles.logoImg}
              resizeMode="contain"
            />
          </View>
         
        </View>

        {/* welcome headline */}
        <View style={styles.welcomeBlock}>
           <View style={styles.brandTextWrap}>
            <AppText style={styles.brandName} color="#FFFFFF">BookMyWorker<Trademark onDark size={19} /></AppText>
            <AppText style={styles.brandSub}  color="rgba(255,255,255,0.65)">
              Kaam Dhundo · Paise Kamao
            </AppText>
          </View>
       
          <AppText style={styles.heroHeadline} color="#FFFFFF">
            {t('welcomeBack')}
          </AppText>
          <AppText style={styles.heroSub} color="rgba(255,255,255,0.70)">
            {t('loginSubtitle')}
          </AppText>
        </View>
      </View>

      {/* ════ FORM ════ */}
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
    { backgroundColor: theme.colors.card },
    !isDark && styles.cardShadow,
    {
      opacity: fadeAnim,
      transform: [{ translateY: slideAnim }],
      marginTop: 2,
    },
  ]}
>
               <View style={[styles.welcomeBadge, { marginBottom: 16 }]}>
            <AppText style={styles.welcomeBadgeText} color={ORANGE}>{'👋  '}{t('welcomeBack')}</AppText>
          </View>
            {/* Login mode tabs */}
            <View style={[
              styles.modeTabs,
              {
                borderColor: isDark ? theme.colors.border : '#E2E8F0',
                backgroundColor: isDark ? theme.colors.surface : '#F1F5F9',
              },
            ]}>
              {(['password', 'otp'] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setMode(m)}
                  activeOpacity={0.8}
                  style={[styles.modeTab, mode === m && styles.modeTabActive]}
                >
                  <AppText
                    variant="labelSm"
                    color={mode === m ? '#FFFFFF' : theme.colors.mutedText}
                    style={mode === m ? styles.modeTabTextActive : undefined}
                  >
                    {m === 'otp' ? `📱  ${t('otpLoginTab')}` : `🔒  ${t('passwordLoginTab')}`}
                  </AppText>
                </TouchableOpacity>
              ))}
            </View>

            {mode === 'otp'
              ? <OtpLoginForm    key="otp"      navigation={navigation as any} roleHint={roleHint} appContext="agent-app" />
              : <PasswordLoginForm key="password" navigation={navigation as any} roleHint={roleHint} appContext="agent-app" />
            }
          </Animated.View>

          {/* Register link */}
          <AppText variant="body" color={theme.colors.mutedText} style={styles.registerRow}>
            {t('newToApp')}{'  '}
            <AppText variant="body" color={BRAND} style={styles.registerLink} onPress={() => navigation.navigate('Register')}>
              {t('createAccount')}
            </AppText>
          </AppText>

          {/* Section divider */}
          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: isDark ? theme.colors.border : '#E2E8F0' }]} />
            <AppText variant="micro" color={theme.colors.mutedText} style={styles.dividerLabel}>
              {t('loginWhyBmw')}
            </AppText>
            <View style={[styles.dividerLine, { backgroundColor: isDark ? theme.colors.border : '#E2E8F0' }]} />
          </View>

          {/* Trust badges */}
          <View style={styles.trustGrid}>
            {trustItems.map((item) => (
              <View
                key={item.text}
                style={[
                  styles.trustBadge,
                  {
                    backgroundColor: isDark ? theme.colors.surface : '#FFFFFF',
                    borderColor:     isDark ? theme.colors.border  : '#DDE8F8',
                  },
                ]}
              >
                <AppText style={styles.trustIcon}>{item.icon}</AppText>
                <AppText variant="micro" color={BRAND} style={styles.trustText}>
                  {item.text}
                </AppText>
              </View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

/* ─── Styles ─────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  root: { flex: 1 },

  /* Hero */
  hero: {
    backgroundColor: BRAND,
    paddingHorizontal: 24,
    paddingBottom: 40,
    overflow: 'hidden',
  },
  circle: { position: 'absolute', borderRadius: 999 },
  c1: { width: 280, height: 280, top: -120, right: -80, backgroundColor: 'rgba(255,255,255,0.055)' },
  c2: { width: 150, height: 150, bottom: -50, right: 30,  backgroundColor: 'rgba(249,115,22,0.09)'   },
  c3: { width: 90,  height: 90,  top: 30,   left: -30,   backgroundColor: 'rgba(255,255,255,0.04)'  },
  orangeBar: {
    position: 'absolute', bottom: 0, left: 0,
    width: W * 0.38, height: 4,
    backgroundColor: ORANGE, borderTopRightRadius: 999,
  },

  backBtn: { alignSelf: 'flex-start', marginBottom: 18 },
  backCircle: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },
  backArrow: { fontSize: 26, lineHeight: 30, fontWeight: '300', marginTop: -2 },

  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 22 },
  logoBox: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },
  logoImg: { width: 56, height: 56 },
  brandTextWrap: { flex: 1 },
  brandName: { fontSize: 19, fontWeight: '800', lineHeight: 24, letterSpacing: -0.3 },
  brandSub:  { fontSize: 12, marginTop: 3 },

  welcomeBlock: { gap: 8 },
  welcomeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(249,115,22,0.14)',
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.25)',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999, marginBottom: 2,
  },
  welcomeBadgeText: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.5 },
  heroHeadline: { fontSize: 28, fontWeight: '900', lineHeight: 36, letterSpacing: -0.6 },
  heroSub:      { fontSize: 13.5, lineHeight: 20 },

  /* Form area */
  kav:    { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },

  card: { borderRadius: 24, padding: 22, marginTop: -18 },
  cardShadow: {
    shadowColor: BRAND,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  },

  modeTabs: {
    flexDirection: 'row',
    borderRadius: 14, borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 22,
    padding: 4, gap: 4,
  },
  modeTab: {
    flex: 1, paddingVertical: 11,
    alignItems: 'center', borderRadius: 10,
  },
  modeTabActive: {
    backgroundColor: BRAND,
    shadowColor: BRAND,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.30,
    shadowRadius: 8,
    elevation: 4,
  },
  modeTabTextActive: { fontWeight: '700' },

  registerRow: {
    textAlign: 'center',
    marginTop: 22,
  },
  registerLink: { fontWeight: '800' },

  dividerRow:  { flexDirection: 'row', alignItems: 'center', marginTop: 24, marginBottom: 14, gap: 10 },
  dividerLine: { flex: 1, height: 1 },
  dividerLabel:{ fontWeight: '600', letterSpacing: 0.3 },

  trustGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  trustBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 12, borderWidth: 1,
    shadowColor: BRAND,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  trustIcon: { fontSize: 15, lineHeight: 19 },
  trustText: { fontWeight: '700', fontSize: 12 },
});
