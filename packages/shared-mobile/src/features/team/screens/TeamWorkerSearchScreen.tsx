import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../state/auth/AuthContext';
import { AppText } from '../../../shared/components/ui/AppText';
import { useAppTheme } from '../../../core/theme';
import { WorkerSearchScreen } from '../../search/screens/WorkerSearchScreen';

/**
 * Find Workers for a team member: the normal worker search (running through the team gateway, so it follows their permissions and
 * the owner's plan), with a slim bar that always says whose team they are working for and a way back to the team home.
 */
export const TeamWorkerSearchScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { state } = useAuth();
  const team = state.session?.team;
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
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}><AppText variant="label" color={theme.colors.primary}>← Home</AppText></Pressable>
        <View style={s.who}>
          <AppText variant="label" color={theme.colors.text} numberOfLines={1}>{team?.company}</AppText>
          <AppText variant="caption" color={theme.colors.mutedText} numberOfLines={1}>Team · {team?.memberName}</AppText>
        </View>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  who: { flex: 1, minWidth: 0 },
});
