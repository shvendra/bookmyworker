import React from 'react';
import { Image, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from '../../../shared/components/ui/AppText';
import { useAppTheme } from '../../../core/theme';

interface Props {
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  /** Show the "or" divider above the button (default true). */
  withDivider?: boolean;
  /** Small hint under the button (e.g. "choose your role first"). */
  hint?: string;
}

// "Continue with Google" button + optional "or" divider, shared by the Agent app's login and register screens.
export const GoogleButton = ({ onPress, busy = false, disabled = false, withDivider = true, hint }: Props): React.JSX.Element => {
  const { t } = useTranslation();
  const { theme } = useAppTheme();
  const off = busy || disabled;
  return (
    <View style={{ marginTop: 16 }}>
      {withDivider && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: '#E2E8F0' }} />
          <AppText style={{ marginHorizontal: 10, color: theme.colors.mutedText, fontSize: 12 }}>{t('orLabel') || 'or'}</AppText>
          <View style={{ flex: 1, height: 1, backgroundColor: '#E2E8F0' }} />
        </View>
      )}
      <TouchableOpacity
        onPress={onPress}
        disabled={off}
        activeOpacity={0.85}
        accessibilityRole="button"
        style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
          backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#E2E8F0',
          borderRadius: 14, paddingVertical: 14, opacity: off ? 0.45 : 1,
        }}
      >
        <Image source={{ uri: 'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg' }} style={{ width: 18, height: 18 }} />
        <AppText style={{ fontSize: 15, fontWeight: '700', color: '#1F2937' }}>
          {busy ? t('processing') : (t('continueWithGoogle') || 'Continue with Google')}
        </AppText>
      </TouchableOpacity>
      {!!hint && (
        <AppText style={{ marginTop: 8, fontSize: 12, color: theme.colors.mutedText, textAlign: 'center' }}>{hint}</AppText>
      )}
    </View>
  );
};
