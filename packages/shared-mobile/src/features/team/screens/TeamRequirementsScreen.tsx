import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { AppText } from '../../../shared/components/ui/AppText';
import { useAppTheme } from '../../../core/theme';
import { apiClient } from '../../../core/api/client';
import type { RootStackParamList } from '../../../app/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'TeamRequirements'>;
interface Row { _id: string; workType?: string; subCategory?: string; status?: string; district?: string; state?: string; ERN_NUMBER?: string; createdAt?: string }

/** The owner's requirements for a team member: tap one to open it ("My Requirements") or to mark its attendance ("Attendance"). */
export const TeamRequirementsScreen = ({ route, navigation }: Props): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
  const insets = useSafeAreaInsets();
  const mode = route.params?.mode ?? 'requirements';
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await apiClient.get<{ requirements?: Row[] }>('/api/v1/application', { params: { limit: 50 } });
      setRows(r.data.requirements ?? []); setError('');
    } catch (e) { setError((e as Error).message || t('team_req_load_fail')); }
  }, [t]);
  useEffect(() => { void load(); }, [load]);

  const open = (r: Row): void => {
    const title = [r.workType, r.subCategory].filter(Boolean).join(' · ') || t('team_requirement');
    if (mode === 'attendance') navigation.navigate('EmployerAttendance', { requirementId: r._id, requirementTitle: title });
    else navigation.navigate('RequirementDetail', { requirementId: r._id });
  };

  return (
    <View style={[s.root, { backgroundColor: theme.colors.background, paddingTop: insets.top + 8 }]}>
      <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={s.back}><AppText variant="label" color={theme.colors.primary}>← {t('back')}</AppText></Pressable>
      <AppText variant="heading" color={theme.colors.text} style={s.title}>{mode === 'attendance' ? t('team_req_att_title') : t('team_req_title')}</AppText>
      <AppText variant="caption" color={theme.colors.mutedText} style={s.title}>{mode === 'attendance' ? t('team_req_att_hint') : t('team_req_hint')}</AppText>
      {error ? (
        <View style={s.center}><AppText variant="body" color={theme.colors.mutedText} center>{error}</AppText><AppButton title={t('retry')} onPress={() => void load()} /></View>
      ) : !rows ? (
        <View style={s.center}><ActivityIndicator /></View>
      ) : (
        <FlatList
          data={rows} keyExtractor={(r) => r._id} contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: insets.bottom + 24 }}
          ListEmptyComponent={<AppText variant="body" color={theme.colors.mutedText} center>{t('team_req_empty')}</AppText>}
          renderItem={({ item }) => (
            <Pressable onPress={() => open(item)} style={[s.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
              <AppText variant="label" color={theme.colors.text}>{[item.workType, item.subCategory].filter(Boolean).join(' · ') || t('team_requirement')}</AppText>
              <AppText variant="caption" color={theme.colors.mutedText}>{[item.district, item.state].filter(Boolean).join(', ')}{item.ERN_NUMBER ? `  ·  ${item.ERN_NUMBER}` : ''}</AppText>
              {!!item.status && <AppText variant="caption" color={theme.colors.primary}>{item.status}</AppText>}
            </Pressable>
          )}
        />
      )}
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1 },
  back: { paddingHorizontal: 16, paddingVertical: 6 },
  title: { paddingHorizontal: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 4 },
});
