import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { AppText } from '../../../shared/components/ui/AppText';
import { useAppTheme } from '../../../core/theme';

/** Stand-in for screens a team member does not have (notifications, subscription …) so nothing opens a dead end. */
export const TeamInfoScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
  const navigation = useNavigation();
  return (
    <View style={[s.root, { backgroundColor: theme.colors.background }]}>
      <AppText variant="heading" color={theme.colors.text} center>{t('team_info_title')}</AppText>
      <AppText variant="body" color={theme.colors.mutedText} center style={s.msg}>
        {t('team_info_body')}
      </AppText>
      <AppButton title={t('team_go_back')} onPress={() => navigation.goBack()} />
    </View>
  );
};
const s = StyleSheet.create({ root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }, msg: { marginBottom: 8 } });
