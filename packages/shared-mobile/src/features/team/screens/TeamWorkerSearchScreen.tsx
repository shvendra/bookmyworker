import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Alert } from 'react-native';
import { useAuth } from '../../../state/auth/AuthContext';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { AppText } from '../../../shared/components/ui/AppText';
import { useAppTheme } from '../../../core/theme';
import { teamApi } from '../../../core/api/endpoints/teamApi';
import { WorkerSearchScreen } from '../../search/screens/WorkerSearchScreen';

/**
 * A team member's whole app: the normal worker search (running through the team gateway, so it follows their permissions and
 * the owner's plan), with a slim bar that always says whose team they are working for, and a logout.
 */
export const TeamWorkerSearchScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { state, signOut } = useAuth();
  const team = state.session?.team;
  const leave = (): void =>
    Alert.alert(`Leave ${team?.company}'s team?`, 'You lose access right away. Your employer will see that you left, and has to add you again if you want to come back.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => { void teamApi.leave().then(() => signOut(), (e: Error) => Alert.alert('Could not leave', e.message || 'Please try again.')); } },
    ]);
  const canSearch = !!team?.permissions.includes('workers:search');

  return (
    <View style={s.root}>
      <View style={s.body}>
        {canSearch ? <WorkerSearchScreen /> : (
          <View style={s.empty}>
            <AppText variant="body" color={theme.colors.mutedText} center>
              You don't have any permission yet. Ask {team?.company} to enable "Find workers" for you.
            </AppText>
          </View>
        )}
      </View>
      <View style={[s.bar, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border, paddingBottom: insets.bottom + 8 }]}>
        <View style={s.who}>
          <AppText variant="label" color={theme.colors.text} numberOfLines={1}>{team?.company}</AppText>
          <AppText variant="caption" color={theme.colors.mutedText} numberOfLines={1}>Team · {team?.memberName}</AppText>
        </View>
        <AppButton title="Leave" variant="ghost" size="sm" onPress={leave} />
        <AppButton title="Logout" variant="outline" size="sm" onPress={signOut} />
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  who: { flex: 1, minWidth: 0 },
});
