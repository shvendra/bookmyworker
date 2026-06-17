import AsyncStorage from '@react-native-async-storage/async-storage';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import i18n from '../../../../packages/shared-mobile/src/core/i18n';
import { langPendingKey } from '../../../../packages/shared-mobile/src/core/i18n/useLangSync';
import { AppButton } from '../../../../packages/shared-mobile/src/shared/components/ui/AppButton';
import { AppText } from '../../../../packages/shared-mobile/src/shared/components/ui/AppText';
import { Trademark } from '../../../../packages/shared-mobile/src/shared/components/ui/Trademark';
import type { AppLanguage } from '../../../../packages/shared-mobile/src/shared/types/domain';
import type { EmployerStackParamList } from '../../navigation/types';

export const EMPLOYER_LANG_KEY = 'bmw_employer_lang';

const BRAND = '#1037A4';
const { width: W } = Dimensions.get('window');
const CARD_GAP = 12;
const GRID_PAD = 18;
const CARD_SIZE = (W - 48 - CARD_GAP) / 2;
// Full row width (matches the grid's left/right padding) — used for the
// final card when it would otherwise sit alone in a half-width column.
const CARD_FULL = W - GRID_PAD * 2;

const LANGUAGES: { code: AppLanguage; native: string; english: string }[] = [
  { code: 'hi', native: 'हिंदी', english: 'Hindi' },
  { code: 'en', native: 'English', english: 'English' },
  { code: 'mr', native: 'मराठी', english: 'Marathi' },
  { code: 'gu', native: 'ગુજરાતી', english: 'Gujarati' },
  { code: 'ta', native: 'தமிழ்', english: 'Tamil' },
  { code: 'te', native: 'తెలుగు', english: 'Telugu' },
  { code: 'kn', native: 'ಕನ್ನಡ', english: 'Kannada' },
  { code: 'ml', native: 'മലയാളം', english: 'Malayalam' },
  { code: 'bn', native: 'বাংলা', english: 'Bengali' },
  { code: 'or', native: 'ଓଡ଼ିଆ', english: 'Odia' },
  { code: 'pa', native: 'ਪੰਜਾਬੀ', english: 'Punjabi' },
];

type Props = NativeStackScreenProps<EmployerStackParamList, 'LanguageSelect'>;

export const LanguageSelectScreen = ({ navigation }: Props): React.JSX.Element => {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('employer');
  // English is the default-selected language on this picker.
  const [selected, setSelected] = useState<AppLanguage>('en');
  const [saving, setSaving] = useState(false);

  // Render this language picker in English by default (this is the first-launch
  // language screen — shown only when no language has been chosen yet).
  useEffect(() => {
    void i18n.changeLanguage('en');
  }, []);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 60, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim, scaleAnim]);

  const handleContinue = async () => {
    if (saving) return;
    setSaving(true);
    await AsyncStorage.setItem(EMPLOYER_LANG_KEY, selected);
    // Mark this as a deliberate pick so it wins over any stale DB language on the
    // next login (useLangSync consumes the marker once).
    await AsyncStorage.setItem(langPendingKey(EMPLOYER_LANG_KEY), selected);
    await i18n.changeLanguage(selected);
    navigation.replace('Welcome');
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND} />

      {/* ── Blue header ─────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.circleTopRight} />
        <View style={styles.circleBottomLeft} />

        <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
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

          <AppText style={styles.heroTitle}>{t('langSelectTitle')}</AppText>
          <AppText style={styles.heroSub}>अपनी भाषा चुनें  •  Select your language</AppText>

          <View style={styles.stepRow}>
            <View style={[styles.stepDot, styles.stepDotActive]} />
            <View style={styles.stepLine} />
            <View style={styles.stepDot} />
            <View style={styles.stepLine} />
            <View style={styles.stepDot} />
          </View>
        </Animated.View>
      </View>

      {/* ── Language grid ────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.gridContainer,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <FlatList
          data={LANGUAGES}
          keyExtractor={(item) => item.code}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => {
            const isSelected = selected === item.code;
            // Last item with no row-mate (odd count) → stretch to full width.
            const isLoneLast =
              index === LANGUAGES.length - 1 && LANGUAGES.length % 2 === 1;
            return (
              <Pressable
                style={({ pressed }) => [
                  styles.card,
                  isLoneLast && styles.cardFull,
                  isSelected && styles.cardSelected,
                  pressed && !isSelected && styles.cardPressed,
                ]}
                onPress={() => {
                  setSelected(item.code);
                  void i18n.changeLanguage(item.code);
                }}
                android_ripple={{ color: 'rgba(16,55,164,0.1)', borderless: false }}
              >
                {isSelected && (
                  <View style={styles.checkBadge}>
                    <AppText style={styles.checkIcon}>✓</AppText>
                  </View>
                )}
                <AppText
                  style={[styles.nativeText, isSelected && styles.textWhite]}
                  numberOfLines={1}
                >
                  {item.native}
                </AppText>
                <AppText style={[styles.englishLabel, isSelected && styles.textWhiteFaded]}>
                  {item.english}
                </AppText>
              </Pressable>
            );
          }}
        />
      </Animated.View>

      {/* ── Continue CTA ─────────────────────────────────────── */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {
          /* istanbul ignore next -- `selected` always holds a value, so the null arm is dead */
          selected ? (
            <AppText style={styles.selectedHint}>
              {t('langSelectSelected')}{' '}
              <AppText style={styles.selectedHintBold}>
                {LANGUAGES.find((l) => l.code === selected)?.native}
              </AppText>
            </AppText>
          ) : null
        }
        <AppButton
          title={saving ? t('langSelectWait') : t('langSelectContinue')}
          onPress={handleContinue}
          disabled={saving}
          loading={saving}
          fullWidth
          size="lg"
          iconRight={saving ? undefined : '→'}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F0F4FF',
  },

  // ── Header ──────────────────────────────────────
  header: {
    backgroundColor: BRAND,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  circleTopRight: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  circleBottomLeft: {
    position: 'absolute',
    bottom: -30,
    left: -30,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    gap: 12,
  },
  // White rounded logo box — matches the agent app landing page
  logoBox: {
    width: 52,
    height: 52,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },
  logoImg: {
    width: 52,
    height: 52,
  },
  brandName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 24,
    lineHeight: 33,
    fontWeight: '800',
    marginBottom: 6,
  },
  heroSub: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    marginBottom: 18,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  stepDotActive: {
    backgroundColor: '#fff',
    width: 20,
    borderRadius: 4,
  },
  stepLine: {
    flex: 1,
    height: 2,
    maxWidth: 24,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginHorizontal: 4,
  },

  // ── Grid ─────────────────────────────────────────
  gridContainer: {
    flex: 1,
  },
  grid: {
    padding: 18,
    paddingTop: 16,
    paddingBottom: 12,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: CARD_GAP,
  },
  card: {
    width: CARD_SIZE,
    paddingVertical: 16,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    position: 'relative',
    minHeight: 78,
    justifyContent: 'center',
  },
  cardFull: {
    width: CARD_FULL,
  },
  cardSelected: {
    backgroundColor: BRAND,
    borderColor: BRAND,
    shadowColor: BRAND,
    shadowOpacity: 0.3,
    elevation: 7,
  },
  cardPressed: {
    backgroundColor: '#EEF2FF',
    borderColor: BRAND,
  },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkIcon: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
  },
  nativeText: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 3,
  },
  englishLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  textWhite: {
    color: '#fff',
  },
  textWhiteFaded: {
    color: 'rgba(255,255,255,0.70)',
  },

  // ── Footer ──────────────────────────────────────
  footer: {
    backgroundColor: '#fff',
    paddingTop: 14,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -4 },
    elevation: 10,
  },
  selectedHint: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 10,
  },
  selectedHintBold: {
    fontWeight: '700',
    color: BRAND,
  },
});
