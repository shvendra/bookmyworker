import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../state/auth/AuthContext';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { AppText } from '../../../shared/components/ui/AppText';
import { useAppTheme } from '../../../core/theme';
import { apiClient } from '../../../core/api/client';
import { teamApi } from '../../../core/api/endpoints/teamApi';
import { teamModulesFor, type TeamModuleKey } from '../teamEligibility';
import type { RootStackParamList } from '../../../app/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'TeamHome'>;
interface Stats { totalJobs: number; totalApplications: number; hiredWorkers: number; completedJobs: number }

/** A team member's home: only the modules their employer has switched on, plus the dashboard summary when allowed. */
export const TeamHomeScreen = ({ navigation }: Props): React.JSX.Element => {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { state, signOut } = useAuth();
  const team = state.session?.team;
  const modules = teamModulesFor(team?.permissions);
  const canDashboard = !!team?.permissions.includes('dashboard:view');
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!canDashboard) return;
    void apiClient.get<{ stats?: Stats }>('/api/v1/employer/dashboard').then((r) => setStats(r.data.stats ?? null), () => setStats(null));
  }, [canDashboard]);

  const go = (key: TeamModuleKey): void => {
    switch (key) {
      case 'post': navigation.navigate('PostRequirement'); break;
      case 'requirements': navigation.navigate('TeamRequirements', { mode: 'requirements' }); break;
      case 'attendance': navigation.navigate('TeamRequirements', { mode: 'attendance' }); break;
      case 'calendar': navigation.navigate('RequirementCalendar'); break;
      case 'workers': navigation.navigate('WorkerSearch'); break;
      default: break; // dashboard is shown right here
    }
  };
  const leave = (): void =>
    Alert.alert(`Leave ${team?.company}'s team?`, 'You lose access right away. Your employer will see that you left, and has to add you again if you want to come back.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => { void teamApi.leave().then(() => signOut(), (e: Error) => Alert.alert('Could not leave', e.message || 'Please try again.')); } },
    ]);

  const tiles: [string, number | undefined][] = [['Requirements', stats?.totalJobs], ['Responses', stats?.totalApplications], ['Hired', stats?.hiredWorkers], ['Completed', stats?.completedJobs]];
  const actions = modules.filter((m) => m.key !== 'dashboard');

  return (
    <View style={[s.root, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24, gap: 14 }}>
        <View>
          <AppText variant="caption" color={theme.colors.primary} style={s.kicker}>TEAM</AppText>
          <AppText variant="heading" color={theme.colors.text}>{team?.company}</AppText>
          <AppText variant="caption" color={theme.colors.mutedText}>Signed in as {team?.memberName}</AppText>
        </View>

        {canDashboard && (
          <View style={s.tiles}>
            {tiles.map(([label, value]) => (
              <View key={label} style={[s.tile, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
                <AppText variant="heading" color={theme.colors.text}>{value ?? '–'}</AppText>
                <AppText variant="caption" color={theme.colors.mutedText}>{label}</AppText>
              </View>
            ))}
          </View>
        )}

        {!modules.length && <AppText variant="body" color={theme.colors.mutedText}>You don't have any permission yet. Ask {team?.company} to give you access.</AppText>}
        {actions.map((m) => (
          <Pressable key={m.key} onPress={() => go(m.key)} style={[s.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
            <AppText variant="heading" color={theme.colors.text}>{m.emoji}</AppText>
            <View style={s.flex}>
              <AppText variant="label" color={theme.colors.text}>{m.label}</AppText>
              <AppText variant="caption" color={theme.colors.mutedText}>{m.desc}</AppText>
            </View>
            <AppText variant="label" color={theme.colors.mutedText}>›</AppText>
          </Pressable>
        ))}

        <View style={s.btnRow}>
          <AppButton title="Leave team" variant="ghost" onPress={leave} style={s.flex} />
          <AppButton title="Logout" variant="outline" onPress={signOut} style={s.flex} />
        </View>
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1 },
  kicker: { letterSpacing: 1.4, fontWeight: '700' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { flexGrow: 1, flexBasis: '45%', borderWidth: 1, borderRadius: 14, padding: 14, gap: 2 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 14 },
  flex: { flex: 1 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
});
