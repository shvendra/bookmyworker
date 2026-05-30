import React, { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { useAppTheme } from '../../../core/theme';
import { requirementsApi } from '../../../core/api/endpoints/requirementsApi';
import type { InvitedRequirement } from '../../../core/api/endpoints/requirementsApi';
import { AppText } from '../../../shared/components/ui/AppText';
import { useToast } from '../../../shared/state/toast/ToastContext';
import type { MainStackParamList } from '../../../app/navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  invited:  { label: 'Invited',   color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
  accepted: { label: 'Accepted',  color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0' },
  declined: { label: 'Declined',  color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
};

const fmtDate = (d?: string) => {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return ''; }
};

const InvitationCard = React.memo(({
  item, onAccept, onDecline, responding,
}: {
  item: InvitedRequirement;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  responding: string | null;
}): React.JSX.Element => {
  const { theme } = useAppTheme();
  const inv = item.invitation;
  const meta = STATUS_META[inv?.status ?? 'invited'] ?? STATUS_META.invited;
  const isPending = inv?.status === 'invited';
  const isBusy = responding === item._id;

  return (
    <View style={[card.wrap, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      <View style={[card.accentStrip, { backgroundColor: meta.color }]} />
      <View style={card.inner}>
        <View style={card.topRow}>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText style={[card.title, { color: theme.colors.text }]} numberOfLines={1}>
              {(item.workType ?? '').replace(/_/g, ' ')}{item.subCategory ? ` · ${item.subCategory.replace(/_/g, ' ')}` : ''}
            </AppText>
            {(item.district || item.state) ? (
              <AppText style={[card.meta, { color: theme.colors.mutedText }]}>
                📍 {[item.district, item.state].filter(Boolean).join(', ')}
              </AppText>
            ) : null}
            {item.ERN_NUMBER ? (
              <AppText style={[card.meta, { color: theme.colors.mutedText }]}>ERN #{item.ERN_NUMBER}</AppText>
            ) : null}
          </View>
          <View style={[card.statusPill, { backgroundColor: meta.bg, borderColor: meta.border }]}>
            <AppText style={[card.statusTxt, { color: meta.color }]}>{meta.label}</AppText>
          </View>
        </View>

        {item.employerName ? (
          <View style={card.employerRow}>
            <AppText style={{ fontSize: 12 }}>🏢</AppText>
            <AppText style={[card.employerTxt, { color: theme.colors.mutedText }]}>{item.employerName}</AppText>
          </View>
        ) : null}

        {inv?.invitedAt ? (
          <AppText style={[card.dateTxt, { color: theme.colors.mutedText }]}>
            Invited on {fmtDate(inv.invitedAt)}
          </AppText>
        ) : null}

        {isPending && (
          <View style={card.actions}>
            <TouchableOpacity
              onPress={() => onDecline(item._id)}
              disabled={isBusy}
              style={[card.declineBtn, isBusy && { opacity: 0.5 }]}
              activeOpacity={0.8}
            >
              {isBusy ? <ActivityIndicator size="small" color="#DC2626" /> : <AppText style={card.declineTxt}>Decline</AppText>}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onAccept(item._id)}
              disabled={isBusy}
              style={[card.acceptBtn, isBusy && { opacity: 0.5 }]}
              activeOpacity={0.85}
            >
              {isBusy ? <ActivityIndicator size="small" color="#fff" /> : <AppText style={card.acceptTxt}>Accept</AppText>}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
});
InvitationCard.displayName = 'InvitationCard';

const card = StyleSheet.create({
  wrap:        { borderRadius: 16, borderWidth: 1, marginBottom: 10, overflow: 'hidden', flexDirection: 'row', elevation: 2, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
  accentStrip: { width: 4 },
  inner:       { flex: 1, padding: 14, gap: 6 },
  topRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title:       { fontSize: 15, fontWeight: '800', lineHeight: 20 },
  meta:        { fontSize: 12, fontWeight: '500' },
  statusPill:  { borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, flexShrink: 0 },
  statusTxt:   { fontSize: 11, fontWeight: '800' },
  employerRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  employerTxt: { fontSize: 12, fontWeight: '600' },
  dateTxt:     { fontSize: 11, marginTop: 2 },
  actions:     { flexDirection: 'row', gap: 8, marginTop: 8 },
  declineBtn:  { flex: 1, borderRadius: 12, borderWidth: 1.5, borderColor: '#FECACA', paddingVertical: 10, alignItems: 'center' },
  declineTxt:  { fontSize: 13, fontWeight: '700', color: '#DC2626' },
  acceptBtn:   { flex: 2, borderRadius: 12, backgroundColor: '#7C3AED', paddingVertical: 10, alignItems: 'center' },
  acceptTxt:   { fontSize: 13, fontWeight: '800', color: '#fff' },
});

type FilterOption = 'all' | 'invited' | 'accepted' | 'declined';
const FILTERS: FilterOption[] = ['all', 'invited', 'accepted', 'declined'];

export const InvitationsScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const navigation = useNavigation<Nav>();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterOption>('all');
  const [responding, setResponding] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['my-invitations'],
    queryFn: () => requirementsApi.getMyInvitations(1, 50),
    staleTime: 60 * 1000,
  });

  const respondMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'accepted' | 'declined' }) =>
      requirementsApi.respondToInvitation(id, status),
    onMutate: ({ id }) => setResponding(id),
    onSuccess: (_, { status }) => {
      toast.success(status === 'accepted' ? 'Invitation accepted!' : 'Invitation declined.');
      void queryClient.invalidateQueries({ queryKey: ['my-invitations'] });
    },
    onError: () => toast.error('Failed to respond. Please try again.'),
    onSettled: () => setResponding(null),
  });

  const handleAccept  = useCallback((id: string) => respondMutation.mutate({ id, status: 'accepted' }), [respondMutation]);
  const handleDecline = useCallback((id: string) => respondMutation.mutate({ id, status: 'declined' }), [respondMutation]);

  const allInvitations = data?.invitations ?? [];
  const filtered = filter === 'all' ? allInvitations : allInvitations.filter((i) => i.invitation?.status === filter);
  const pendingCount = allInvitations.filter((i) => i.invitation?.status === 'invited').length;

  const renderItem = useCallback(({ item }: { item: InvitedRequirement }) => (
    <InvitationCard
      item={item}
      onAccept={handleAccept}
      onDecline={handleDecline}
      responding={responding}
    />
  ), [handleAccept, handleDecline, responding]);

  return (
    <View style={[s.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="#1037A4" />
      <ScreenHeader title="Job Invitations" onBack={() => navigation.goBack()} />

      {/* Filter chips */}
      <View style={s.filterRow}>
        {FILTERS.map((f) => {
          const active = filter === f;
          const count = f === 'all' ? allInvitations.length : allInvitations.filter((i) => i.invitation?.status === f).length;
          return (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              style={[s.chip, active && { backgroundColor: '#7C3AED', borderColor: '#7C3AED' }, !active && { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
              activeOpacity={0.8}
            >
              <AppText style={[s.chipTxt, { color: active ? '#fff' : theme.colors.mutedText }]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {count > 0 ? ` (${count})` : ''}
              </AppText>
            </TouchableOpacity>
          );
        })}
      </View>

      {isLoading && !data ? (
        <View style={s.center}><ActivityIndicator size="large" color="#7C3AED" /></View>
      ) : isError ? (
        <View style={s.center}>
          <AppText style={s.errorTxt}>Could not load invitations.</AppText>
          <TouchableOpacity onPress={() => void refetch()} style={s.retryBtn}>
            <AppText style={s.retryTxt}>Retry</AppText>
          </TouchableOpacity>
        </View>
      ) : filtered.length === 0 ? (
        <View style={s.empty}>
          <AppText style={{ fontSize: 48, marginBottom: 12 }}>📬</AppText>
          <AppText style={[s.emptyTitle, { color: theme.colors.text }]}>
            {filter === 'all' ? 'No invitations yet' : `No ${filter} invitations`}
          </AppText>
          <AppText style={[s.emptySub, { color: theme.colors.mutedText }]}>
            {filter === 'all'
              ? 'When employers invite you for their requirements, they will appear here.'
              : `You have no ${filter} invitations.`}
          </AppText>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => void refetch()} tintColor="#7C3AED" />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const s = StyleSheet.create({
  container:  { flex: 1 },
  filterRow:  { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  chip:       { borderRadius: 20, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 6 },
  chipTxt:    { fontSize: 12, fontWeight: '700' },
  list:       { padding: 14, paddingTop: 4, paddingBottom: 40 },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorTxt:   { fontSize: 14, color: '#DC2626', fontWeight: '600' },
  retryBtn:   { backgroundColor: '#7C3AED', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 10 },
  retryTxt:   { color: '#fff', fontWeight: '700', fontSize: 14 },
  empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  emptySub:   { fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
