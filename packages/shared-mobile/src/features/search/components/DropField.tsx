import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { AppText } from '../../../shared/components/ui/AppText';
import { useAppTheme } from '../../../core/theme';
import { BRAND } from './workerSearchShared';

// ─── Dropdown Field ───────────────────────────────────────────────────────────
export const DropField = ({
  label,
  value,
  placeholder,
  onPress,
  disabled,
  locked = false,
}: {
  label: string;
  value: string;
  placeholder: string;
  onPress: () => void;
  disabled?: boolean;
  /** Plan-locked: stays tappable (to surface the upgrade message) but shows a lock. */
  locked?: boolean;
}): React.JSX.Element => {
  const { theme } = useAppTheme();
  const active = !!value;
  // A locked field must remain pressable so tapping it can explain the plan limit;
  // only a genuinely-disabled (e.g. "pick a state first") field is non-interactive.
  const isDisabled = !!disabled && !locked;
  return (
    <View style={{ marginBottom: 12 }}>
      <AppText style={[df.label, { color: theme.colors.mutedText }]}>{label}</AppText>
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.75}
        style={[
          df.field,
          {
            borderColor: active ? BRAND : theme.colors.border,
            backgroundColor: active ? theme.colors.primaryLight : theme.colors.card,
            opacity: isDisabled ? 0.45 : locked ? 0.7 : 1,
          },
        ]}
      >
        <AppText
          style={[df.text, { color: active ? BRAND : theme.colors.mutedText }]}
          numberOfLines={2}
        >
          {value || placeholder}
        </AppText>
        <AppText style={[df.chevron, { color: active ? BRAND : theme.colors.mutedText }]}>{locked ? '🔒' : '›'}</AppText>
      </TouchableOpacity>
    </View>
  );
};
const df = StyleSheet.create({
  label:   { fontSize: 11, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 },
  field:   { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13 },
  text:    { flex: 1, fontSize: 14, fontWeight: '500' },
  chevron: { fontSize: 20, fontWeight: '300' },
});
