import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAppTheme } from '../../../core/theme';
import { AppText } from './AppText';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = Math.min(SCREEN_W - 48, 340);

export type AlertType = 'error' | 'success' | 'warning' | 'info' | 'confirm';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface AppAlertConfig {
  title: string;
  message?: string;
  type?: AlertType;
  buttons?: AlertButton[];
  cancelable?: boolean;
}

interface Props {
  visible: boolean;
  config: AppAlertConfig | null;
  onDismiss: () => void;
}

const TYPE_META: Record<AlertType, { icon: string; color: string; bgColor: string; lightBg: string }> = {
  error:   { icon: '✕',  color: '#DC2626', bgColor: '#DC2626', lightBg: '#FEF2F2' },
  success: { icon: '✓',  color: '#059669', bgColor: '#059669', lightBg: '#ECFDF5' },
  warning: { icon: '!',  color: '#D97706', bgColor: '#D97706', lightBg: '#FFFBEB' },
  info:    { icon: 'i',  color: '#1A56DB', bgColor: '#1A56DB', lightBg: '#EBF1FF' },
  confirm: { icon: '?',  color: '#7C3AED', bgColor: '#7C3AED', lightBg: '#F3EFFE' },
};

function inferType(title: string, buttons?: AlertButton[]): AlertType {
  if (buttons && buttons.length >= 2 && buttons.some((b) => b.style === 'cancel')) return 'confirm';
  const lower = title.toLowerCase();
  if (/error|fail|invalid|required|cannot|unable|wrong|oops/.test(lower)) return 'error';
  if (/done|success|applied|upload|verif|saved|complet|activat|placed/.test(lower)) return 'success';
  if (/close|cancel|sure|delete|remove|warning/.test(lower)) return 'confirm';
  return 'info';
}

export const AppAlertModal = ({ visible, config, onDismiss }: Props): React.JSX.Element | null => {
  const { theme } = useAppTheme();
  const isDark = theme.mode === 'dark';

  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.82)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(cardScale, { toValue: 1, useNativeDriver: true, tension: 140, friction: 10 }),
        Animated.timing(cardOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.timing(cardScale, { toValue: 0.9, duration: 140, useNativeDriver: true }),
        Animated.timing(cardOpacity, { toValue: 0, duration: 140, useNativeDriver: true }),
      ]).start(() => {
        // reset for next open
        cardScale.setValue(0.82);
      });
    }
  }, [visible, backdropOpacity, cardScale, cardOpacity]);

  if (!config) return null;

  const { title, message, buttons } = config;
  const type = config.type ?? inferType(title, buttons);
  const meta = TYPE_META[type];
  const cancelable = config.cancelable !== false;

  const resolvedButtons: AlertButton[] =
    buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }];

  const handleButton = (btn: AlertButton): void => {
    onDismiss();
    btn.onPress?.();
  };

  // Split cancel from action buttons
  const cancelBtn = resolvedButtons.find((b) => b.style === 'cancel');
  const actionBtns = resolvedButtons.filter((b) => b.style !== 'cancel');
  const showTwoColumn = resolvedButtons.length === 2;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => { if (cancelable) onDismiss(); }}
    >
      <Pressable
        style={styles.backdrop}
        onPress={() => { if (cancelable) onDismiss(); }}
      >
        <Animated.View style={[styles.backdropFill, { opacity: backdropOpacity }]} />

        {/* Card */}
        <Pressable onPress={() => {/* swallow tap */}}>
          <Animated.View
            style={[
              styles.card,
              {
                backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                width: CARD_W,
                transform: [{ scale: cardScale }],
                opacity: cardOpacity,
                shadowColor: meta.color,
              },
              isDark && { borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
            ]}
          >
            {/* ── Icon hero ── */}
            <View style={[styles.iconSection, { backgroundColor: isDark ? meta.color + '22' : meta.lightBg }]}>
              {/* Decorative circles */}
              <View style={[styles.deco1, { backgroundColor: meta.color + '18' }]} pointerEvents="none" />
              <View style={[styles.deco2, { backgroundColor: meta.color + '12' }]} pointerEvents="none" />

              {/* Icon circle */}
              <View style={[styles.iconCircleOuter, { backgroundColor: meta.color + '28' }]}>
                <View style={[styles.iconCircleInner, { backgroundColor: meta.color }]}>
                  <AppText style={styles.iconText}>{meta.icon}</AppText>
                </View>
              </View>
            </View>

            {/* ── Content ── */}
            <View style={styles.content}>
              <AppText style={[styles.title, { color: isDark ? '#F1F5F9' : '#0F172A' }]}>
                {title}
              </AppText>
              {!!message && (
                <AppText style={[styles.message, { color: isDark ? '#94A3B8' : '#475569' }]}>
                  {message}
                </AppText>
              )}
            </View>

            {/* ── Buttons ── */}
            <View
              style={[
                styles.buttonArea,
                { borderTopColor: isDark ? 'rgba(255,255,255,0.07)' : '#F1F5F9' },
                showTwoColumn && styles.buttonAreaRow,
              ]}
            >
              {showTwoColumn ? (
                <>
                  {/* Cancel on left */}
                  {cancelBtn && (
                    <TouchableOpacity
                      style={[styles.btn, styles.btnCancel, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#F1F5F9' }]}
                      onPress={() => handleButton(cancelBtn)}
                      activeOpacity={0.7}
                    >
                      <AppText style={[styles.btnCancelText, { color: isDark ? '#CBD5E1' : '#475569' }]} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.3}>
                        {cancelBtn.text}
                      </AppText>
                    </TouchableOpacity>
                  )}
                  {/* Action on right */}
                  {actionBtns.map((btn, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[
                        styles.btn,
                        styles.btnAction,
                        { backgroundColor: btn.style === 'destructive' ? '#DC2626' : meta.color },
                      ]}
                      onPress={() => handleButton(btn)}
                      activeOpacity={0.82}
                    >
                      <AppText style={styles.btnActionText} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.3}>{btn.text}</AppText>
                    </TouchableOpacity>
                  ))}
                </>
              ) : (
                /* Stacked buttons for 1 or 3+ */
                resolvedButtons.map((btn, i) => {
                  const isCancel = btn.style === 'cancel';
                  const isDestructive = btn.style === 'destructive';
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[
                        styles.btnStack,
                        isCancel && [styles.btnStackCancel, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#F1F5F9' }],
                        !isCancel && [styles.btnStackAction, { backgroundColor: isDestructive ? '#DC2626' : meta.color }],
                        i > 0 && styles.btnStackGap,
                      ]}
                      onPress={() => handleButton(btn)}
                      activeOpacity={0.78}
                    >
                      <AppText
                        style={[
                          styles.btnStackText,
                          isCancel && { color: isDark ? '#CBD5E1' : '#475569' },
                          !isCancel && { color: '#FFFFFF' },
                        ]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        maxFontSizeMultiplier={1.3}
                      >
                        {btn.text}
                      </AppText>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdropFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7,14,30,0.65)',
  },
  card: {
    borderRadius: 28,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.26,
    shadowRadius: 32,
    elevation: 20,
  },

  // ── Icon hero ───────────────────────────────────────────────────────────────
  iconSection: {
    height: 116,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  deco1: {
    position: 'absolute',
    top: -34,
    right: -34,
    width: 130,
    height: 130,
    borderRadius: 65,
  },
  deco2: {
    position: 'absolute',
    bottom: -24,
    left: -24,
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  iconCircleOuter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  iconText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 30,
    textAlign: 'center',
  },

  // ── Content ─────────────────────────────────────────────────────────────────
  content: {
    paddingHorizontal: 26,
    paddingTop: 22,
    paddingBottom: 18,
    gap: 9,
    alignItems: 'center',
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 25,
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 14.5,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 21,
  },

  // ── Buttons ─────────────────────────────────────────────────────────────────
  buttonArea: {
    paddingHorizontal: 18,
    paddingBottom: 18,
    paddingTop: 4,
    gap: 11,
  },
  buttonAreaRow: {
    flexDirection: 'row',
    gap: 11,
  },
  btn: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancel: {
    backgroundColor: '#F1F5F9',
  },
  btnCancelText: {
    fontSize: 15,
    fontWeight: '700',
  },
  btnAction: {
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 12,
    elevation: 6,
  },
  btnActionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  // Stacked (single or 3+)
  btnStack: {
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnStackCancel: {
    backgroundColor: '#F1F5F9',
  },
  btnStackAction: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.26,
    shadowRadius: 10,
    elevation: 5,
  },
  btnStackText: {
    fontSize: 15,
    fontWeight: '800',
  },
  btnStackGap: {
    marginTop: 0,
  },
});
