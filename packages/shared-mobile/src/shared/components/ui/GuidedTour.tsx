import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppTheme } from '../../../core/theme';
import { AppText } from './AppText';

export interface TourStep {
  icon: string;
  title: string;
  desc: string;
}

interface GuidedTourProps {
  tourKey: string;
  steps: TourStep[];
  skipLabel: string;
  nextLabel: string;
  backLabel: string;
  finishLabel: string;
  stepOfLabel: string; // e.g. "Step {{step}} of {{total}}"
}

export const GuidedTour = ({
  tourKey,
  steps,
  skipLabel,
  nextLabel,
  backLabel,
  finishLabel,
  stepOfLabel,
}: GuidedTourProps): React.JSX.Element | null => {
  const { theme } = useAppTheme();
  const [visible, setVisible] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    void AsyncStorage.getItem(tourKey).then((val) => {
      if (!val) setVisible(true);
    });
  }, [tourKey]);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 12, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, fadeAnim, slideAnim]);

  const dismiss = (): void => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 300, duration: 220, useNativeDriver: true }),
    ]).start(() => {
      setVisible(false);
      void AsyncStorage.setItem(tourKey, '1');
    });
  };

  const animateStep = (nextStep: number): void => {
    Animated.sequence([
      Animated.timing(slideAnim, { toValue: 40, duration: 120, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();
    setStepIdx(nextStep);
  };

  if (!visible || steps.length === 0) return null;

  const step = steps[stepIdx]!;
  const isLast = stepIdx === steps.length - 1;
  const isFirst = stepIdx === 0;

  const stepLabel = stepOfLabel
    .replace('{{step}}', String(stepIdx + 1))
    .replace('{{total}}', String(steps.length));

  const isDark = theme.mode === 'dark';
  const cardBg = isDark ? theme.colors.surface : '#FFFFFF';
  const textColor = theme.colors.text;
  const mutedColor = theme.colors.mutedText;
  const primary = theme.colors.primary;

  return (
    <Modal transparent animationType="none" visible={visible} statusBarTranslucent>
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        {/* Tap backdrop to skip */}
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />

        <Animated.View
          style={[
            styles.card,
            { backgroundColor: cardBg, transform: [{ translateY: slideAnim }] },
            !isDark && styles.cardShadow,
          ]}
        >
          {/* Step counter */}
          <AppText variant="micro" color={mutedColor} style={styles.stepCounter}>
            {stepLabel}
          </AppText>

          {/* Icon */}
          <View style={[styles.iconCircle, { backgroundColor: primary + '15' }]}>
            <AppText style={styles.iconText}>{step.icon}</AppText>
          </View>

          {/* Title */}
          <AppText variant="h3" color={textColor} style={styles.title}>
            {step.title}
          </AppText>

          {/* Description */}
          <AppText variant="body" color={mutedColor} style={styles.desc}>
            {step.desc}
          </AppText>

          {/* Progress dots */}
          <View style={styles.dotsRow}>
            {steps.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor: i === stepIdx ? primary : primary + '30',
                    width: i === stepIdx ? 20 : 6,
                  },
                ]}
              />
            ))}
          </View>

          {/* Buttons */}
          <View style={styles.btnRow}>
            {/* Skip (left) */}
            <Pressable onPress={dismiss} style={styles.skipBtn} hitSlop={8}>
              <AppText variant="small" color={mutedColor}>
                {skipLabel}
              </AppText>
            </Pressable>

            <View style={styles.navBtns}>
              {/* Back */}
              {!isFirst && (
                <Pressable
                  onPress={() => animateStep(stepIdx - 1)}
                  style={[styles.navBtn, styles.backBtn, { borderColor: primary + '40' }]}
                  hitSlop={8}
                >
                  <AppText variant="small" color={primary}>
                    {backLabel}
                  </AppText>
                </Pressable>
              )}

              {/* Next / Finish */}
              <Pressable
                onPress={isLast ? dismiss : () => animateStep(stepIdx + 1)}
                style={[styles.navBtn, styles.nextBtn, { backgroundColor: primary }]}
                hitSlop={8}
              >
                <AppText variant="small" color="#FFFFFF" style={{ fontWeight: '700' }}>
                  {isLast ? finishLabel : nextLabel}
                </AppText>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  card: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 36,
    alignItems: 'center',
  },
  cardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 20,
  },
  stepCounter: {
    alignSelf: 'flex-end',
    marginBottom: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  iconText: {
    fontSize: 38,
    lineHeight: 46,
  },
  title: {
    textAlign: 'center',
    fontWeight: '700',
    marginBottom: 10,
  },
  desc: {
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 22,
    paddingHorizontal: 8,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 28,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  skipBtn: {
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  navBtns: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  navBtn: {
    paddingVertical: 11,
    paddingHorizontal: 22,
    borderRadius: 14,
  },
  backBtn: {
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  nextBtn: {},
});
