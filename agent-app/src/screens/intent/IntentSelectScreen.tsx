import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  Image,
  Linking,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../../../packages/shared-mobile/src/shared/components/ui/AppText';
import { Trademark } from '../../../../packages/shared-mobile/src/shared/components/ui/Trademark';
import type { AgentStackParamList } from '../../navigation/types';

const BRAND = '#1037A4';
// The Employer app on the Play Store — where "I'm hiring workers" users belong.
const EMPLOYER_PLAY_URL = 'https://play.google.com/store/apps/details?id=com.bookmyworkers.employer';

type Props = NativeStackScreenProps<AgentStackParamList, 'IntentSelect'>;

export const IntentSelectScreen = ({ navigation }: Props): React.JSX.Element => {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [redirecting, setRedirecting] = useState(false);

  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(24)).current;
  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
    ]).start();
  }, [fade, slide]);

  // Correct choice for the Worker app → continue the normal flow, unchanged.
  const chooseWork = () => navigation.replace('Welcome');

  // Wrong choice (they want to hire) → send them to the Employer app on the Play Store.
  const chooseHire = () => {
    if (redirecting) return;
    setRedirecting(true);
    Linking.openURL(EMPLOYER_PLAY_URL).catch(() => setRedirecting(false));
  };

  const Card = ({
    icon, title, desc, onPress, accent,
  }: { icon: string; title: string; desc: string; onPress: () => void; accent?: boolean }) => (
    <Pressable
      style={({ pressed }) => [styles.card, accent && styles.cardAccent, pressed && styles.cardPressed]}
      onPress={onPress}
      android_ripple={{ color: 'rgba(16,55,164,0.10)' }}
    >
      <View style={[styles.iconWrap, accent && styles.iconWrapAccent]}>
        <AppText style={styles.icon}>{icon}</AppText>
      </View>
      <View style={styles.cardTextWrap}>
        <AppText style={styles.cardTitle}>{title}</AppText>
        <AppText style={styles.cardDesc}>{desc}</AppText>
      </View>
      <AppText style={styles.chevron}>›</AppText>
    </Pressable>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND} />

      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.circleTopRight} />
        <View style={styles.circleBottomLeft} />
        <View style={styles.logoRow}>
          <View style={styles.logoBox}>
            <Image
              source={require('../../../../packages/shared-mobile/assets/logo.png')}
              style={styles.logoImg}
              resizeMode="contain"
            />
          </View>
          <AppText style={styles.brandName}>BookMyWorker<Trademark onDark size={22} /></AppText>
        </View>
        <AppText style={styles.heroTitle}>{t('intentTitle')}</AppText>
        <AppText style={styles.heroSub}>{t('intentSubtitleWorker')}</AppText>
        <View style={styles.stepRow}>
          <View style={styles.stepDot} />
          <View style={styles.stepLine} />
          <View style={[styles.stepDot, styles.stepDotActive]} />
          <View style={styles.stepLine} />
          <View style={styles.stepDot} />
        </View>
      </View>

      <Animated.View style={[styles.body, { opacity: fade, transform: [{ translateY: slide }] }]}>
        <Card icon="🔍" title={t('intentFindWork')} desc={t('intentFindWorkDesc')} onPress={chooseWork} accent />
        <Card icon="🧑‍🔧" title={t('intentHireWorkers')} desc={t('intentHireWorkersDesc')} onPress={chooseHire} />
        {redirecting && <AppText style={styles.redirectNote}>{t('intentRedirectEmployer')}</AppText>}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F0F4FF' },
  header: {
    backgroundColor: BRAND, paddingHorizontal: 24, paddingBottom: 28,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden',
  },
  circleTopRight: { position: 'absolute', top: -40, right: -40, width: 130, height: 130, borderRadius: 65, backgroundColor: 'rgba(255,255,255,0.08)' },
  circleBottomLeft: { position: 'absolute', bottom: -30, left: -30, width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.06)' },
  logoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18, gap: 12 },
  logoBox: { width: 52, height: 52, borderRadius: 15, backgroundColor: '#FFFFFF', overflow: 'hidden', elevation: 6 },
  logoImg: { width: 52, height: 52 },
  brandName: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: 0.3 },
  heroTitle: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 8 },
  heroSub: { color: 'rgba(255,255,255,0.78)', fontSize: 14, lineHeight: 20, marginBottom: 18 },
  stepRow: { flexDirection: 'row', alignItems: 'center' },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.35)' },
  stepDotActive: { backgroundColor: '#fff', width: 20, borderRadius: 4 },
  stepLine: { flex: 1, height: 2, maxWidth: 24, backgroundColor: 'rgba(255,255,255,0.25)', marginHorizontal: 4 },

  body: { padding: 20, paddingTop: 24, gap: 16 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#fff', borderRadius: 18, padding: 18,
    borderWidth: 1.5, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  cardAccent: { borderColor: BRAND, backgroundColor: '#F5F8FF' },
  cardPressed: { backgroundColor: '#EEF2FF', borderColor: BRAND },
  iconWrap: { width: 54, height: 54, borderRadius: 14, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center' },
  iconWrapAccent: { backgroundColor: '#E0E9FF' },
  icon: { fontSize: 26 },
  cardTextWrap: { flex: 1 },
  cardTitle: { fontSize: 17, fontWeight: '800', color: '#111827', marginBottom: 3 },
  cardDesc: { fontSize: 13, color: '#6B7280', lineHeight: 18 },
  chevron: { fontSize: 30, color: '#9CA3AF', fontWeight: '300', marginTop: -4 },
  redirectNote: { textAlign: 'center', color: BRAND, fontSize: 13, fontWeight: '600', marginTop: 4 },
});
