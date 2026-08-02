/**
 * GradientHeader — Premium screen header with deep-blue gradient feel.
 * Real LinearGradient sheen layered over the base tone. The gradient fades to
 * the base colour at the BOTTOM edge, so headers stay seamless with any hero
 * section rendered directly below (light mode) while gaining subtle depth.
 */
import React from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../../core/theme';
import { AppText } from './AppText';
import { Avatar } from './Avatar';

interface GradientHeaderProps {
  title: string;
  subtitle?: string;
  caption?: string;
  avatarName?: string;
  avatarUri?: string;
  onAvatarPress?: () => void;
  rightIcon?: string;
  onRightPress?: () => void;
  /** Optional second right icon */
  rightIcon2?: string;
  onRightPress2?: () => void;
  /** Optional third right icon */
  rightIcon3?: string;
  onRightPress3?: () => void;
  showBack?: boolean;
  onBack?: () => void;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
  /** Notification count — shown on rightIcon as red badge */
  notifCount?: number;
  /** Custom gradient start color */
  gradientColor?: string;
  /** Small badge overlaid on the avatar (e.g. profile completeness "60%"). */
  avatarBadge?: string;
  avatarBadgeColor?: string;
}

export const GradientHeader = ({
  title,
  subtitle,
  caption,
  avatarName,
  avatarUri,
  onAvatarPress,
  rightIcon,
  onRightPress,
  rightIcon2,
  onRightPress2,
  rightIcon3,
  onRightPress3,
  showBack,
  onBack,
  children,
  style,
  compact = false,
  notifCount,
  gradientColor,
  avatarBadge,
  avatarBadgeColor,
}: GradientHeaderProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const isDark = theme.mode === 'dark';

  const topPad = insets.top; // insets.top already includes status bar on both iOS and Android
  const bgColor = gradientColor ?? (isDark ? theme.colors.headerBg : '#1037A4');
  // Light mode: keep the header a single flat tone (== base) so it blends seamlessly with any
  // hero/section rendered directly below it (no visible seam). Dark mode keeps its subtle depth.
  const bgColor2 = isDark ? theme.colors.headerBg2 : bgColor;

  return (
    <View
      style={[
        styles.outer,
        {
          paddingTop: topPad + (compact ? 10 : 16),
          paddingBottom: compact ? 18 : 26,
          backgroundColor: bgColor,
        },
        style,
      ]}
    >
      {/* Gradient depth layer — fades to the base tone at the bottom edge so the
          header stays seamless with any hero rendered directly below it. */}
      <LinearGradient
        colors={isDark
          ? [bgColor2, bgColor]
          : ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.02)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Large decorative circles */}
      <View style={[styles.circle, styles.circle1, { backgroundColor: 'rgba(255,255,255,0.055)' }]} pointerEvents="none" />
      <View style={[styles.circle, styles.circle2, { backgroundColor: 'rgba(255,255,255,0.04)' }]} pointerEvents="none" />
      <View style={[styles.circle, styles.circle3, { backgroundColor: 'rgba(255,255,255,0.03)' }]} pointerEvents="none" />

      <View style={styles.row}>
        {/* Back button */}
        {showBack && (
          <TouchableOpacity
            onPress={onBack}
            style={styles.backBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <AppText style={styles.backIcon}>←</AppText>
          </TouchableOpacity>
        )}

        {/* Text block */}
        <View style={styles.textBlock}>
          {subtitle ? (
            <AppText variant="micro" color="rgba(255,255,255,0.60)" style={styles.subtitleText}>
              {subtitle}
            </AppText>
          ) : null}
          <AppText
            variant={compact ? 'subtitle' : 'heading'}
            color="#FFFFFF"
            numberOfLines={3}
            ellipsizeMode="tail"
            maxFontSizeMultiplier={1.3}
            style={[styles.titleText, compact && styles.titleCompact]}
          >
            {title.replace(/\b\w/g, (c) => c.toUpperCase())}
          </AppText>
          {caption ? (
            <AppText variant="caption" color="rgba(255,255,255,0.65)" style={styles.captionText}>
              {caption}
            </AppText>
          ) : null}
        </View>

        {/* Right section */}
        <View style={styles.rightSection}>
          {rightIcon3 && onRightPress3 && (
            <TouchableOpacity
              onPress={onRightPress3}
              style={styles.iconBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <AppText style={styles.iconBtnText}>{rightIcon3}</AppText>
            </TouchableOpacity>
          )}
          {rightIcon2 && onRightPress2 && (
            <TouchableOpacity
              onPress={onRightPress2}
              style={styles.iconBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <AppText style={styles.iconBtnText}>{rightIcon2}</AppText>
            </TouchableOpacity>
          )}
          {rightIcon && onRightPress && (
            <TouchableOpacity
              onPress={onRightPress}
              style={styles.iconBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <AppText style={styles.iconBtnText}>{rightIcon}</AppText>
              {notifCount != null && notifCount > 0 && (
                <View style={styles.notifBadge}>
                  <AppText style={styles.notifCount}>
                    {notifCount > 99 ? '99+' : String(notifCount)}
                  </AppText>
                </View>
              )}
            </TouchableOpacity>
          )}
          {avatarName && (
            <TouchableOpacity
              onPress={onAvatarPress}
              disabled={!onAvatarPress}
              style={styles.avatarWrap}
            >
              <Avatar
                name={avatarName}
                uri={avatarUri}
                size={42}
                ring
                ringColor="rgba(255,255,255,0.55)"
              />
              {avatarBadge ? (
                <View style={[styles.avatarBadge, { backgroundColor: avatarBadgeColor ?? '#10B981' }]}>
                  <AppText style={styles.avatarBadgeTxt}>{avatarBadge}</AppText>
                </View>
              ) : null}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {children ? <View style={styles.childrenWrap}>{children}</View> : null}
    </View>
  );
};

// ── Simple inner-screen header ─────────────────────────────────────────────────
export const ScreenHeader = ({
  title,
  onBack,
  rightIcon,
  onRightPress,
}: {
  title: string;
  onBack?: () => void;
  rightIcon?: string;
  onRightPress?: () => void;
}): React.JSX.Element => (
  <GradientHeader
    title={title}
    showBack={!!onBack}
    onBack={onBack}
    rightIcon={rightIcon}
    onRightPress={onRightPress}
    compact
  />
);

const styles = StyleSheet.create({
  outer: {
    paddingHorizontal: 20,
    overflow: 'hidden',
    zIndex: 10,
  },
  circle: {
    position: 'absolute',
    borderRadius: 999,
  },
  circle1: { width: 260, height: 260, top: -110, right: -70 },
  circle2: { width: 160, height: 160, bottom: -60, left: '30%' },
  circle3: { width: 120, height: 120, top: 20, left: -40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    color: '#FFFFFF',
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '700',
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  subtitleText: {
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 1,
  },
  titleText: {
    lineHeight: 30,
    fontWeight: '800',
  },
  titleCompact: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
  },
  captionText: {
    marginTop: 2,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconBtnText: {
    fontSize: 19,
    lineHeight: 23,
  },
  notifBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#1037A4',
  },
  notifCount: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 12,
  },
  avatarWrap: { position: 'relative', alignItems: 'center' },
  avatarBadge: {
    position: 'absolute',
    bottom: -7,
    paddingHorizontal: 5,
    paddingVertical: 0.5,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#1037A4',
  },
  avatarBadgeTxt: { color: '#FFFFFF', fontSize: 9, fontWeight: '800', lineHeight: 12 },
  childrenWrap: {
    marginTop: 14,
    marginBottom: -6,
  },
});
