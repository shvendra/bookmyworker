import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../../core/theme';
import { AppText } from '../../../shared/components/ui/AppText';
import type { OtpChannel } from '../utils/otpMode';

const WA_GREEN = '#25D366';

interface OtpChannelPickerProps {
  channel: OtpChannel;
  onChange: (c: OtpChannel) => void;
  disabled?: boolean;
}

/** "Get your OTP via  [WhatsApp] [SMS]" — rendered only when SuperAdmin lets the user choose. */
export const OtpChannelPicker = ({ channel, onChange, disabled = false }: OtpChannelPickerProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation();
  const options: Array<{ value: OtpChannel; label: string; icon: keyof typeof Ionicons.glyphMap; tint: string }> = [
    { value: 'whatsapp', label: 'WhatsApp', icon: 'logo-whatsapp', tint: WA_GREEN },
    { value: 'sms', label: 'SMS', icon: 'chatbubble-ellipses', tint: theme.colors.primary },
  ];
  return (
    <View style={s.wrap} testID="otp-channel-picker">
      <AppText variant="labelSm" color={theme.colors.textSecondary} style={s.title}>{t('otpChoiceTitle')}</AppText>
      <View style={s.row}>
        {options.map((o) => {
          const active = channel === o.value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityState={{ selected: active, disabled }}
              testID={`otp-channel-${o.value}`}
              style={[
                s.pill,
                {
                  borderColor: active ? o.tint : theme.colors.border,
                  backgroundColor: active ? o.tint + '14' : 'transparent',
                  opacity: disabled ? 0.6 : 1,
                },
              ]}
            >
              <Ionicons name={o.icon} size={16} color={active ? o.tint : theme.colors.mutedText} />
              <AppText variant="bodyMd" color={active ? o.tint : theme.colors.text} style={s.label}>{o.label}</AppText>
              {active && <Ionicons name="checkmark-circle" size={16} color={o.tint} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

interface OtherChannelLinkProps {
  /** The channel currently in use — the link offers the OTHER one. */
  channel: OtpChannel;
  onPress: () => void;
  disabled?: boolean;
}

/** "Send via SMS instead" / "Send via WhatsApp instead" — shown under the resend button in user-choice mode. */
export const OtpOtherChannelLink = ({ channel, onPress, disabled = false }: OtherChannelLinkProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation();
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={8} testID="otp-other-channel" style={[s.link, { opacity: disabled ? 0.5 : 1 }]}>
      <Ionicons name={channel === 'sms' ? 'logo-whatsapp' : 'chatbubble-ellipses'} size={14} color={theme.colors.primary} />
      <AppText variant="caption" color={theme.colors.primary} style={s.linkTxt}>
        {t(channel === 'sms' ? 'otpTryWhatsApp' : 'otpTrySms')}
      </AppText>
    </Pressable>
  );
};

const s = StyleSheet.create({
  wrap: { marginBottom: 14 },
  title: { marginBottom: 8 },
  row: { flexDirection: 'row', gap: 10 },
  pill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 11, borderRadius: 12, borderWidth: 1.5 },
  label: { fontWeight: '700' },
  link: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  linkTxt: { fontWeight: '700' },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 10, marginBottom: 12 },
  noticeTxt: { flex: 1, fontWeight: '600', lineHeight: 18 },
});

/** Shown instead of any OTP option when neither WhatsApp nor SMS can carry an OTP right now. */
export const OtpUnavailableNotice = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation();
  return (
    <View style={[s.notice, { backgroundColor: theme.colors.dangerLight }]} testID="otp-unavailable">
      <Ionicons name="alert-circle" size={16} color={theme.colors.danger} />
      <AppText variant="caption" color={theme.colors.danger} style={s.noticeTxt}>{t('otpUnavailable')}</AppText>
    </View>
  );
};
