import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '../../../../packages/shared-mobile/src/shared/components/ui/AppButton';
import { AppText } from '../../../../packages/shared-mobile/src/shared/components/ui/AppText';
import { useAppTheme } from '../../../../packages/shared-mobile/src/core/theme';
import {
  useAppConfig,
  formatStat,
} from '../../../../packages/shared-mobile/src/core/api/endpoints/appConfigApi';
import type { AgentStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AgentStackParamList, 'Welcome'>;

const { width: W } = Dimensions.get('window');

const BRAND  = '#1037A4';
const ORANGE = '#F97316';

const WORK_TYPES = [
  { icon: '🏗️', label: 'Construction' },
  { icon: '🏭', label: 'Factory' },
  { icon: '🚜', label: 'Agriculture' },
  { icon: '🔧', label: 'Technician' },
  { icon: '🏠', label: 'Household' },
  { icon: '🚚', label: 'Delivery' },
];

export const AgentWelcomeScreen = ({ navigation }: Props): React.JSX.Element => {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { config, isLoading: configLoading } = useAppConfig();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const bodyAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(200, [
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(bodyAnim, { toValue: 1, useNativeDriver: true, tension: 55, friction: 9 }),
    ]).start();
  }, [fadeAnim, bodyAnim]);

  const isDark = theme.mode === 'dark';

  const stats = useMemo(() => [
    { value: formatStat(config.stats.workerCount),      label: 'Workers' },
    { value: formatStat(config.stats.requirementCount), label: 'Jobs Filled' },
    { value: formatStat(config.stats.agentCount),       label: 'Agents' },
    { value: formatStat(config.stats.employerCount),    label: 'Employers' },
  ], [config.stats]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND} />

      {/* ── Hero ────────────────────────────────────────────────── */}
      <View style={[styles.hero, { paddingTop: insets.top + 14 }]}>
        <View style={[styles.circle, styles.c1]} />
        <View style={[styles.circle, styles.c2]} />
        <View style={[styles.circle, styles.c3]} />
        <View style={styles.orangeBar} />

        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Brand row */}
          <View style={styles.brandRow}>
            <View style={styles.logoBox}>
              <Image
                source={require('../../../../packages/shared-mobile/assets/logo.png')}
                style={styles.logoImg}
                resizeMode="contain"
              />
            </View>
            <View style={styles.brandTextWrap}>
              <AppText style={styles.brandName} color="#FFFFFF">BookMyWorker</AppText>
              <View style={styles.tagPill}>
                <View style={styles.tagDot} />
                <AppText style={styles.tagText} color={ORANGE}>INDIA'S WORKFORCE PLATFORM</AppText>
              </View>
            </View>
          </View>

          {/* Headline */}
          <View style={styles.headlineBlock}>
            <AppText style={styles.headline} color="#FFFFFF">Kaam Dhundo,{'\n'}</AppText>
            <AppText style={[styles.headline, { color: ORANGE }]}>Paise Kamao</AppText>
            <AppText style={styles.heroSub} color="rgba(255,255,255,0.72)">
              Find work near you. Register workers.{'\n'}Earn commissions. Grow your network.
            </AppText>
          </View>

          {/* Live pill */}
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <AppText style={styles.liveText} color="#FFFFFF">
              {formatStat(config.stats.workerCount)} Workers active right now
            </AppText>
          </View>
        </Animated.View>
      </View>

      {/* ── White body ──────────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.body,
          { backgroundColor: isDark ? theme.colors.background : '#FFFFFF' },
          {
            opacity: bodyAnim,
            transform: [{ translateY: bodyAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
          },
        ]}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

          {/* Stats card */}
          <View style={[
            styles.statsCard,
            {
              borderColor: isDark ? theme.colors.border : '#DDE8F8',
              backgroundColor: isDark ? theme.colors.surface : '#F4F8FF',
            },
          ]}>
            {configLoading ? (
              <View style={styles.statsLoading}>
                <ActivityIndicator size="small" color={BRAND} />
              </View>
            ) : (
              <View style={styles.statsRow}>
                {stats.map((s, i) => (
                  <View
                    key={s.label}
                    style={[
                      styles.statItem,
                      i < stats.length - 1 && {
                        borderRightWidth: 1,
                        borderRightColor: isDark ? theme.colors.border : '#D0DDEF',
                      },
                    ]}
                  >
                    <AppText style={styles.statValue}>{s.value}</AppText>
                    <AppText style={styles.statLabel} color={theme.colors.mutedText}>{s.label}</AppText>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Work categories */}
          <View style={styles.section}>
            <AppText style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Jobs available in your area
            </AppText>
            <View style={styles.chipRow}>
              {WORK_TYPES.map((w) => (
                <View
                  key={w.label}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isDark ? theme.colors.surface : '#FFF5EC',
                      borderColor: isDark ? theme.colors.border : '#FDD5B0',
                    },
                  ]}
                >
                  <AppText style={styles.chipIcon}>{w.icon}</AppText>
                  <AppText style={[styles.chipLabel, { color: BRAND }]}>{w.label}</AppText>
                </View>
              ))}
            </View>
          </View>

          {/* Role boxes */}
          <View style={styles.rolesRow}>
            <TouchableOpacity
              style={[styles.roleBox, { backgroundColor: '#EBF1FF', borderColor: '#C3D3F5' }]}
              onPress={() => navigation.navigate('Register')}
              activeOpacity={0.82}
            >
              <View style={[styles.roleIconWrap, { backgroundColor: 'rgba(16,55,164,0.1)' }]}>
                <AppText style={styles.roleEmoji}>🤝</AppText>
              </View>
              <AppText style={[styles.roleTitle, { color: BRAND }]}>Agent</AppText>
              <AppText style={[styles.roleDesc, { color: BRAND }]}>Register workers{'\n'}& earn commission</AppText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.roleBox, { backgroundColor: '#FFF3E8', borderColor: '#FDD5B0' }]}
              onPress={() => navigation.navigate('Register')}
              activeOpacity={0.82}
            >
              <View style={[styles.roleIconWrap, { backgroundColor: 'rgba(249,115,22,0.1)' }]}>
                <AppText style={styles.roleEmoji}>👷</AppText>
              </View>
              <AppText style={[styles.roleTitle, { color: ORANGE }]}>Job Seeker</AppText>
              <AppText style={[styles.roleDesc, { color: ORANGE }]}>Find{'\n'}work near you</AppText>
            </TouchableOpacity>
          </View>

          {/* CTA */}
          <View style={styles.cta}>
            <AppButton
              title="Get Started — Log In"
              onPress={() => navigation.navigate('Login')}
              size="lg"
              fullWidth
            />
            <AppButton
              title="Create New Account"
              onPress={() => navigation.navigate('Register')}
              variant="outline"
              size="lg"
              fullWidth
              style={styles.outlineBtn}
            />
            <AppText variant="caption" color={theme.colors.mutedText} center style={styles.terms}>
              By continuing you agree to our Terms of Service & Privacy Policy
            </AppText>
          </View>

        </ScrollView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BRAND },

  hero: {
    backgroundColor: BRAND,
    paddingHorizontal: 24,
    paddingBottom: 30,
    overflow: 'hidden',
  },
  circle: { position: 'absolute', borderRadius: 999 },
  c1: { width: 300, height: 300, top: -130, right: -90, backgroundColor: 'rgba(255,255,255,0.055)' },
  c2: { width: 160, height: 160, top: 60,  left: -60,  backgroundColor: 'rgba(249,115,22,0.08)' },
  c3: { width: 110, height: 110, bottom: 10, right: W * 0.08, backgroundColor: 'rgba(255,255,255,0.04)' },
  orangeBar: {
    position: 'absolute', bottom: 0, right: 0,
    width: W * 0.4, height: 4,
    backgroundColor: ORANGE, borderTopLeftRadius: 999,
  },

  // Brand row
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  logoBox: {
    width: 56, height: 56,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    marginRight: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },
  logoImg: { width: 56, height: 56 },
  brandTextWrap: { flex: 1 },
  brandName: { fontSize: 19, fontWeight: '800', lineHeight: 24, letterSpacing: -0.3 },
  tagPill: {
    flexDirection: 'row', alignItems: 'center', marginTop: 4,
    backgroundColor: 'rgba(249,115,22,0.14)',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 999, alignSelf: 'flex-start', gap: 5,
  },
  tagDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: ORANGE },
  tagText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },

  headlineBlock: { marginBottom: 18 },
  headline: { fontSize: 33, fontWeight: '900', lineHeight: 42, letterSpacing: -0.8 },
  heroSub: { fontSize: 13.5, lineHeight: 21, marginTop: 10 },

  livePill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 13, paddingVertical: 8,
    borderRadius: 999, alignSelf: 'flex-start',
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E', marginRight: 8 },
  liveText: { fontSize: 12.5, fontWeight: '600' },

  // Body
  body: { flex: 1, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  scroll: { paddingHorizontal: 18, paddingTop: 22, paddingBottom: 36 },

  // Stats
  statsCard: {
    borderRadius: 18, borderWidth: 1,
    marginBottom: 22, overflow: 'hidden',
    shadowColor: BRAND,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  statsLoading: { paddingVertical: 22, alignItems: 'center' },
  statsRow: { flexDirection: 'row', paddingVertical: 16 },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  statValue: { fontSize: 19, fontWeight: '900', color: BRAND, letterSpacing: -0.5, lineHeight: 25 },
  statLabel: { fontSize: 11, fontWeight: '500', lineHeight: 15, marginTop: 2 },

  // Categories
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 13.5, fontWeight: '700', marginBottom: 11 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 999, borderWidth: 1,
  },
  chipIcon: { fontSize: 14, lineHeight: 18, marginRight: 5 },
  chipLabel: { fontSize: 12, fontWeight: '600' },

  // Role boxes
  rolesRow: { flexDirection: 'row', marginBottom: 22, gap: 12 },
  roleBox: {
    flex: 1, borderRadius: 20, padding: 18,
    borderWidth: 1.5, alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  roleIconWrap: {
    width: 54, height: 54, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  roleEmoji: { fontSize: 28, lineHeight: 34 },
  roleTitle: { fontSize: 15, fontWeight: '800', lineHeight: 21, marginBottom: 4 },
  roleDesc: { fontSize: 12, fontWeight: '500', textAlign: 'center', lineHeight: 17 },

  // CTA
  cta: { gap: 10 },
  outlineBtn: { backgroundColor: 'transparent' },
  terms: { marginTop: 6, fontSize: 11, lineHeight: 16 },
});
