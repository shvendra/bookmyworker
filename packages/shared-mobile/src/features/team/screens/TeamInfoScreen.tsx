import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { AppText } from '../../../shared/components/ui/AppText';
import { useAppTheme } from '../../../core/theme';

/** Stand-in for screens a team member does not have (notifications, subscription …) so nothing opens a dead end. */
export const TeamInfoScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const navigation = useNavigation();
  return (
    <View style={[s.root, { backgroundColor: theme.colors.background }]}>
      <AppText variant="heading" color={theme.colors.text} center>Not available for team accounts</AppText>
      <AppText variant="body" color={theme.colors.mutedText} center style={s.msg}>
        Plans, payments and account settings are managed by your employer.
      </AppText>
      <AppButton title="Go back" onPress={() => navigation.goBack()} />
    </View>
  );
};
const s = StyleSheet.create({ root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }, msg: { marginBottom: 8 } });
