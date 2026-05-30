import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Image, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../core/theme';
import { AppText } from '../ui/AppText';

const LOGO = require('../../../../assets/logo.png') as number;

const BRAND  = '#1037A4';
const ORANGE = '#F97316';

interface LoadingStateProps {
  label?: string;
  message?: string;
  /** true = full-screen branded splash (app boot only). false (default) = simple centered spinner for page loads. */
  fullscreen?: boolean;
}

export const LoadingState = ({ label, message, fullscreen = false }: LoadingStateProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const text = message ?? label;

  // ── Simple page-level spinner ────────────────────────────────────────────────
  if (!fullscreen) {
    return (
      <View style={[page.container, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        {text ? (
          <AppText variant="caption" color={theme.colors.mutedText} style={page.label} center>
            {text}
          </AppText>
        ) : null}
      </View>
    );
  }

  // ── Full-screen branded splash (app boot) ────────────────────────────────────
  return <AppSplash text={text} />;
};

// Separate component so hooks only run when fullscreen is true
const AppSplash = ({ text }: { text?: string }): React.JSX.Element => {
  const pulse1   = useRef(new Animated.Value(0.4)).current;
  const pulse2   = useRef(new Animated.Value(0.4)).current;
  const pulse3   = useRef(new Animated.Value(0.4)).current;
  const logoScale = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.spring(logoScale, {
      toValue: 1,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    }).start();

    const dot = (val: Animated.Value, delay: number): Animated.CompositeAnimation =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, { toValue: 1,   duration: 400, useNativeDriver: true }),
          Animated.timing(val, { toValue: 0.4, duration: 400, useNativeDriver: true }),
          Animated.delay(400),
        ])
      );

    const a1 = dot(pulse1, 0);
    const a2 = dot(pulse2, 160);
    const a3 = dot(pulse3, 320);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [pulse1, pulse2, pulse3, logoScale]);

  return (
    <View style={splash.root}>
      <View style={[splash.circle, splash.c1]} />
      <View style={[splash.circle, splash.c2]} />
      <View style={[splash.circle, splash.c3]} />
      <View style={splash.orangeStrip} />

      <Animated.View style={[splash.logoWrap, { transform: [{ scale: logoScale }] }]}>
        <View style={splash.logoBox}>
          <Image source={LOGO} style={splash.logoImg} resizeMode="contain" />
        </View>
      </Animated.View>

      <AppText style={splash.brandName}>BookMyWorker</AppText>
      <AppText style={splash.tagline}>Connecting workers & employers</AppText>

      <View style={splash.dotsRow}>
        {[pulse1, pulse2, pulse3].map((p, i) => (
          <Animated.View key={i} style={[splash.dot, { opacity: p }]} />
        ))}
      </View>

      {text ? <AppText style={splash.message}>{text}</AppText> : null}
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const page = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  label: { lineHeight: 20, marginTop: 4 },
});

const splash = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  circle: { position: 'absolute', borderRadius: 999 },
  c1: { width: 380, height: 380, top: -160, right: -100, backgroundColor: 'rgba(255,255,255,0.055)' },
  c2: { width: 200, height: 200, bottom: -60, right: 20,  backgroundColor: 'rgba(249,115,22,0.09)'  },
  c3: { width: 120, height: 120, top: 60,    left: -50,   backgroundColor: 'rgba(255,255,255,0.04)' },
  orangeStrip: {
    position: 'absolute', bottom: 0, left: 0,
    width: '38%', height: 4,
    backgroundColor: ORANGE, borderTopRightRadius: 999,
  },

  logoWrap: { marginBottom: 24 },
  logoBox: {
    width: 96, height: 96, borderRadius: 26,
    backgroundColor: '#FFFFFF', overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 14,
  },
  logoImg: { width: 96, height: 96 },

  brandName: {
    fontSize: 28, fontWeight: '900', color: '#FFFFFF',
    letterSpacing: -0.5, lineHeight: 34, marginBottom: 6,
  },
  tagline: {
    fontSize: 13.5, color: 'rgba(255,255,255,0.65)',
    fontWeight: '500', marginBottom: 48,
  },

  dotsRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 16 },
  dot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: ORANGE,
  },

  message: {
    fontSize: 12, color: 'rgba(255,255,255,0.55)',
    fontWeight: '500', textAlign: 'center',
  },
});
