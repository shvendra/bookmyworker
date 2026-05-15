import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { ROUTES } from '../../../shared/constants/routes';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { AppText } from '../../../shared/components/ui/AppText';
import { useAppTheme } from '../../../core/theme';
import type { AuthStackParamList } from '../../../app/navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

const { width: W, height: H } = Dimensions.get('window');

const FEATURES = [
  { icon: '👷', title: 'Hire Workers Fast',     desc: 'Connect with 5 lakh+ skilled & unskilled workers across India' },
  { icon: '📋', title: 'Manage Requirements',   desc: 'Post, track and close job requirements in minutes' },
  { icon: '💼', title: 'Agent Network',         desc: 'Agents bring pre-verified workers from your district' },
  { icon: '💳', title: 'Digital Payments',      desc: 'Transparent wage tracking with wallet & payout system' },
];

export const WelcomeScreen = ({ navigation }: Props): React.JSX.Element => {
  const { theme } = useAppTheme();

  const heroAnim = useRef(new Animated.Value(0)).current;
  const cardsAnim = useRef(new Animated.Value(0)).current;
  const ctaAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(160, [
      Animated.spring(heroAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 9 }),
      Animated.spring(cardsAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 9 }),
      Animated.spring(ctaAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 9 }),
    ]).start();
  }, [heroAnim, cardsAnim, ctaAnim]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#1338B0" />

      {/* ── Hero header ─────────────────────────────────────────────── */}
      <View style={styles.hero}>
        <View style={[styles.decoCircle, styles.decoCircle1]} />
        <View style={[styles.decoCircle, styles.decoCircle2]} />

        <SafeAreaView>
          <Animated.View
            style={[
              styles.heroContent,
              {
                opacity: heroAnim,
                transform: [{ translateY: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
              },
            ]}
          >
            <View style={styles.logoMark}>
              <AppText style={styles.logoEmoji}>🏗️</AppText>
            </View>
            <AppText variant="display" color="#FFFFFF" style={styles.heroTitle}>
              BookMyWorker
            </AppText>
            <AppText variant="body" color="rgba(255,255,255,0.78)" style={styles.heroSubtitle}>
              India's trusted platform connecting{'\n'}employers, agents & workers
            </AppText>
            <View style={styles.proofPill}>
              <View style={styles.proofDots}>
                {['#10B981', '#F59E0B', '#3B82F6'].map((c, i) => (
                  <View key={c} style={[styles.proofDot, { backgroundColor: c, marginLeft: i > 0 ? -6 : 0 }]} />
                ))}
              </View>
              <AppText variant="micro" color="rgba(255,255,255,0.9)" style={styles.proofText}>
                5 Lakh+ workers active today
              </AppText>
            </View>
          </Animated.View>
        </SafeAreaView>
      </View>

      {/* ── Body ──────────────────────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.body,
          { backgroundColor: theme.colors.background },
          {
            opacity: cardsAnim,
            transform: [{ translateY: cardsAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
          },
        ]}
      >
        <View style={styles.featureGrid}>
          {FEATURES.map((feat) => (
            <View
              key={feat.icon}
              style={[
                styles.featureCard,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.mode === 'dark' ? theme.colors.border : '#EBF0F8',
                },
              ]}
            >
              <AppText style={styles.featureIcon}>{feat.icon}</AppText>
              <AppText variant="labelSm" color={theme.colors.text} style={styles.featureTitle}>
                {feat.title}
              </AppText>
              <AppText variant="caption" color={theme.colors.mutedText} numberOfLines={2} style={styles.featureDesc}>
                {feat.desc}
              </AppText>
            </View>
          ))}
        </View>

        <Animated.View
          style={[
            styles.cta,
            {
              opacity: ctaAnim,
              transform: [{ translateY: ctaAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
            },
          ]}
        >
          <AppButton
            title="Get Started — Log In"
            onPress={() => navigation.navigate(ROUTES.AUTH.LOGIN)}
            size="lg"
            fullWidth
          />
          <AppButton
            title="Create New Account"
            onPress={() => navigation.navigate(ROUTES.AUTH.REGISTER)}
            variant="outline"
            size="lg"
            fullWidth
            style={styles.registerBtn}
          />
          <AppText variant="caption" color={theme.colors.mutedText} center style={styles.terms}>
            By continuing, you agree to our Terms of Service & Privacy Policy
          </AppText>
        </Animated.View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },

  hero: {
    backgroundColor: '#1338B0',
    paddingHorizontal: 24,
    paddingBottom: 44,
    overflow: 'hidden',
    minHeight: H * 0.42,
    justifyContent: 'flex-end',
  },
  decoCircle: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)' },
  decoCircle1: { width: 280, height: 280, top: -120, right: -80 },
  decoCircle2: { width: 160, height: 160, bottom: -40, left: W * 0.3 },
  heroContent: { paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 20 : 20 },
  logoMark: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  logoEmoji: { fontSize: 34, lineHeight: 38 },
  heroTitle: { fontSize: 30, lineHeight: 38, fontWeight: '900', letterSpacing: -0.5, marginBottom: 8 },
  heroSubtitle: { lineHeight: 24, marginBottom: 20 },
  proofPill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, alignSelf: 'flex-start',
  },
  proofDots: { flexDirection: 'row', alignItems: 'center' },
  proofDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#1338B0' },
  proofText: { marginLeft: 8 },

  body: {
    flex: 1, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    marginTop: -24, paddingTop: 28, paddingHorizontal: 20, paddingBottom: 20,
  },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24, flex: 1, alignContent: 'flex-start' },
  featureCard: { width: (W - 40 - 10) / 2, borderRadius: 16, padding: 14, borderWidth: 1, gap: 6 },
  featureIcon: { fontSize: 26, lineHeight: 32 },
  featureTitle: { lineHeight: 18 },
  featureDesc: { lineHeight: 16 },

  cta: { gap: 10 },
  registerBtn: { backgroundColor: 'transparent' },
  terms: { marginTop: 6, lineHeight: 16 },
});
