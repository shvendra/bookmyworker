import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Share, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { AppText } from '../../../shared/components/ui/AppText';
import { useAppTheme } from '../../../core/theme';
import { useToast } from '../../../shared/state/toast/ToastContext';
import { nextPermissions, isRequiredByOther, groupPermissions } from '../teamEligibility';
import { teamApi, teamLinkUrl, type TeamActivityRow, type TeamMember, type TeamOverview, type TeamPermission } from '../../../core/api/endpoints/teamApi';

const ACTION_LABEL: Record<string, string> = {
  login: 'Logged in', post_requirement: 'Posted a requirement', update_requirement: 'Updated a requirement', hire_worker: 'Hired a worker', boost_requirement: 'Boosted a requirement',
  shortlist_worker: 'Shortlisted a worker', update_pipeline: 'Moved a worker in the pipeline', invite_worker: 'Invited a worker', mark_attendance: 'Marked attendance', unlock_contact: "Viewed a worker's number", update_status: 'Updated a call status',
  member_added: 'Added to the team', permissions_changed: 'Permissions changed', member_removed: 'Removed by employer', member_left: 'Left the team',
  member_paused: 'Paused', member_resumed: 'Resumed', invite_sent: 'Invite email re-sent',
  admin_paused: 'Paused by BookMyWorker support', admin_resumed: 'Resumed by BookMyWorker support', admin_removed: 'Removed by BookMyWorker support',
};
const REMOVED_BY: Record<string, string> = { owner: 'Removed by you', self: 'Left on their own', admin: 'Removed by BookMyWorker support' };
const validEmail = (v: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
const whenText = (d?: string | null): string => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : 'Never');

interface DialogProps { visible: boolean; member: TeamMember | null; catalog: TeamPermission[]; onClose: () => void; onSaved: () => void }

const MemberDialog = ({ visible, member, catalog, onClose, onSaved }: DialogProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const toast = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [perms, setPerms] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const editing = !!member;

  useEffect(() => {
    if (visible) { setName(member?.name ?? ''); setPhone(member?.phone ?? ''); setEmail(member?.email ?? ''); setPerms(member?.permissions ?? ['workers:search']); }
  }, [visible, member]);

  const save = async (): Promise<void> => {
    setSaving(true);
    try {
      if (member) await teamApi.updateMember(member._id, { name, email, permissions: perms });
      else {
        const r = await teamApi.addMember({ name, phone, email, permissions: perms });
        if (r.emailSent === false) toast.error('Member added, but the invite email could not be sent. Use "Email link" to send it again.');
      }
      toast.success(editing ? 'Team member updated' : 'Team member added — login link emailed');
      onSaved();
    } catch (e) { toast.error((e as Error).message || 'Could not save'); }
    finally { setSaving(false); }
  };

  const valid = name.trim().length >= 2 && perms.length > 0 && validEmail(email) && (editing || phone.length === 10);
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.scrim}>
        <ScrollView style={s.sheetScroll} contentContainerStyle={[s.sheet, { backgroundColor: theme.colors.surface }]} keyboardShouldPersistTaps="handled">
          <AppText variant="heading" color={theme.colors.text}>{editing ? 'Edit team member' : 'Add team member'}</AppText>
          <TextInput value={name} onChangeText={setName} placeholder="Name" placeholderTextColor={theme.colors.mutedText}
            style={[s.input, { color: theme.colors.text, borderColor: theme.colors.border }]} />
          <TextInput value={phone} onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))} editable={!editing} keyboardType="number-pad" maxLength={10}
            placeholder="Mobile number" placeholderTextColor={theme.colors.mutedText}
            style={[s.input, { color: theme.colors.text, borderColor: theme.colors.border, opacity: editing ? 0.6 : 1 }]} />
          <TextInput value={email} onChangeText={(v) => setEmail(v.trim().slice(0, 120))} keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
            placeholder="Email (login link is sent here)" placeholderTextColor={theme.colors.mutedText}
            style={[s.input, { color: theme.colors.text, borderColor: !email || validEmail(email) ? theme.colors.border : '#DC2626' }]} />
          <AppText variant="label" color={theme.colors.text}>What can they do? (changeable any time, per person)</AppText>
          {groupPermissions(catalog).map((g) => (
            <View key={g.name} style={s.group}>
              <AppText variant="caption" color={theme.colors.mutedText} style={s.groupName}>{g.name.toUpperCase()}</AppText>
              {g.items.map((p) => (
                <View key={p.key} style={s.permRow}>
                  <View style={s.permText}>
                    <AppText variant="body" color={theme.colors.text}>{p.label}</AppText>
                    <AppText variant="caption" color={theme.colors.mutedText}>{p.desc}</AppText>
                  </View>
                  <Switch value={perms.includes(p.key)} disabled={isRequiredByOther(perms, p.key)} onValueChange={() => setPerms((c) => nextPermissions(c, p.key))} />
                </View>
              ))}
            </View>
          ))}
          <View style={s.btnRow}>
            <AppButton title="Cancel" variant="ghost" onPress={onClose} style={s.flex} />
            <AppButton title={editing ? 'Save' : 'Add & send link'} onPress={() => void save()} loading={saving} disabled={!valid || saving} style={s.flex} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

/** Owner screen: give staff their own login to work for you, choose what they may do, see what they did. */
export const MyTeamScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const toast = useToast();
  const [data, setData] = useState<TeamOverview | null>(null);
  const [activity, setActivity] = useState<TeamActivityRow[]>([]);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState<{ visible: boolean; member: TeamMember | null }>({ visible: false, member: null });

  const load = useCallback(async () => {
    try {
      const [t, a] = await Promise.all([teamApi.getTeam(), teamApi.getActivity(30)]);
      setData(t); setActivity(a.activity ?? []); setError('');
    } catch (e) { setError((e as Error).message || 'Could not load your team.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const run = async (fn: () => Promise<unknown>, ok: string): Promise<void> => {
    try { await fn(); toast.success(ok); await load(); } catch (e) { toast.error((e as Error).message || 'Action failed'); }
  };
  const confirm = (title: string, message: string, action: string, onYes: () => void, destructive = false): void =>
    Alert.alert(title, message, [{ text: 'Cancel', style: 'cancel' }, { text: action, style: destructive ? 'destructive' : 'default', onPress: onYes }]);

  const pause = (m: TeamMember): void => {
    const pausing = m.status === 'active';
    const go = (): void => void run(() => teamApi.updateMember(m._id, { status: pausing ? 'suspended' : 'active' }), pausing ? 'Paused' : 'Resumed');
    if (pausing) confirm(`Pause ${m.name}?`, "They are signed out right away and can't log in until you resume them.", 'Pause', go); else go();
  };
  const remove = (m: TeamMember): void =>
    confirm(`Remove ${m.name}?`, 'They lose access immediately. Their own personal account (if any) is not affected.', 'Remove', () => void run(() => teamApi.removeMember(m._id), 'Removed'), true);
  const resend = (m: TeamMember): void => void run(() => teamApi.resendInvite(m._id), `Invite emailed to ${m.email}`);
  const rotate = (): void =>
    confirm('Make a new team link?', 'The old link stops working. Your members just need the new link to log in.', 'New link', () => void run(() => teamApi.rotateLink(), 'New link created'));
  const share = (): void => {
    if (!data?.link) return;
    void Share.share({ message: `You have been added to ${data.company}'s team on BookMyWorker. Log in here with your mobile number or email: ${teamLinkUrl(data.link.slug)}` });
  };

  if (error) return <View style={[s.center, { backgroundColor: theme.colors.background }]}><AppText variant="body" color={theme.colors.mutedText} center>{error}</AppText><AppButton title="Retry" onPress={() => void load()} /></View>;
  if (!data) return <View style={[s.center, { backgroundColor: theme.colors.background }]}><ActivityIndicator /></View>;

  const full = data.seats.used >= data.seats.limit;
  const permLabel = (k: string): string => data.permissions.find((p) => p.key === k)?.label ?? k;

  return (
    <View style={[s.root, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24, gap: 14 }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}><AppText variant="label" color={theme.colors.primary}>← Back</AppText></Pressable>
        <AppText variant="heading" color={theme.colors.text}>My Team</AppText>
        <AppText variant="body" color={theme.colors.mutedText}>Let your staff work for {data.company}. They log in separately with their own mobile number and can only do what you allow.</AppText>

        {!data.eligibility.eligible && (
          <View style={[s.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
            <AppText variant="body" color={theme.colors.text}>{data.eligibility.message}</AppText>
          </View>
        )}

        {data.link && data.eligibility.eligible && (
          <View style={[s.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
            <AppText variant="label" color={theme.colors.text}>Team login link</AppText>
            <AppText variant="caption" color={theme.colors.mutedText} selectable>{teamLinkUrl(data.link.slug)}</AppText>
            <View style={s.btnRow}>
              <AppButton title="Share link" size="sm" onPress={share} style={s.flex} />
              <AppButton title="New link" size="sm" variant="outline" onPress={rotate} style={s.flex} />
            </View>
            <AppText variant="caption" color={theme.colors.mutedText}>The page shows "{data.company}". Only the numbers / emails you add below can log in.</AppText>
          </View>
        )}

        <View style={[s.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
          <View style={s.headRow}>
            <AppText variant="label" color={theme.colors.text}>Members ({data.seats.used} of {data.seats.limit})</AppText>
            <AppButton title="Add" size="sm" disabled={!data.eligibility.eligible || full} onPress={() => setDialog({ visible: true, member: null })} />
          </View>
          {full && data.eligibility.eligible && <AppText variant="caption" color={theme.colors.mutedText}>All seats are used. Remove a member to add someone new.</AppText>}
          {!data.members.length && <AppText variant="body" color={theme.colors.mutedText}>No team members yet.</AppText>}
          {data.members.map((m) => (
            <View key={m._id} style={[s.member, { borderTopColor: theme.colors.border }]}>
              <AppText variant="label" color={theme.colors.text}>{m.name}{m.status === 'suspended' ? '  ·  Paused' : ''}</AppText>
              <AppText variant="caption" color={theme.colors.mutedText}>{m.phone}{m.email ? ` · ${m.email}` : ' · (no email yet — tap Edit to add)'}</AppText>
              <AppText variant="caption" color={theme.colors.mutedText}>Last login: {whenText(m.lastLoginAt)}</AppText>
              <AppText variant="caption" color={theme.colors.primary}>{m.permissions.map(permLabel).join(' · ')}</AppText>
              <View style={s.btnRow}>
                {!!m.email && <AppButton title="Email link" size="xs" variant="outline" onPress={() => resend(m)} />}
                <AppButton title="Edit" size="xs" variant="outline" onPress={() => setDialog({ visible: true, member: m })} />
                <AppButton title={m.status === 'active' ? 'Pause' : 'Resume'} size="xs" variant="outline" onPress={() => pause(m)} />
                <AppButton title="Remove" size="xs" variant="danger" onPress={() => remove(m)} />
              </View>
            </View>
          ))}
        </View>

        {!!data.former?.length && (
          <View style={[s.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
            <AppText variant="label" color={theme.colors.text}>Former members (history)</AppText>
            {data.former.map((m) => (
              <View key={m._id} style={[s.actRow, { borderTopColor: theme.colors.border }]}>
                <View style={s.flex}>
                  <AppText variant="caption" color={theme.colors.text}>{m.name}</AppText>
                  <AppText variant="caption" color={theme.colors.mutedText}>{m.phone}{m.email ? ` · ${m.email}` : ''}</AppText>
                </View>
                <View>
                  <AppText variant="caption" color={theme.colors.text}>{REMOVED_BY[m.removedBy ?? ''] ?? 'Removed'}</AppText>
                  <AppText variant="caption" color={theme.colors.mutedText}>{whenText(m.removedAt)}</AppText>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={[s.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
          <AppText variant="label" color={theme.colors.text}>Team activity & history</AppText>
          {!activity.length && <AppText variant="caption" color={theme.colors.mutedText}>Nothing yet.</AppText>}
          {activity.map((a) => (
            <View key={a._id} style={[s.actRow, { borderTopColor: theme.colors.border }]}>
              <AppText variant="caption" color={theme.colors.text} style={s.flex}>{a.memberName} — {ACTION_LABEL[a.action] ?? a.action}</AppText>
              <AppText variant="caption" color={theme.colors.mutedText}>{whenText(a.at)}</AppText>
            </View>
          ))}
        </View>
      </ScrollView>
      <MemberDialog visible={dialog.visible} member={dialog.member} catalog={data.permissions}
        onClose={() => setDialog({ visible: false, member: null })}
        onSaved={() => { setDialog({ visible: false, member: null }); void load(); }} />
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 8 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  member: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, gap: 4 },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  flex: { flex: 1 },
  actRow: { flexDirection: 'row', gap: 8, paddingTop: 6, borderTopWidth: StyleSheet.hairlineWidth },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheetScroll: { maxHeight: '90%' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, gap: 10 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 16 },
  group: { gap: 6, marginTop: 4 },
  groupName: { letterSpacing: 1, fontWeight: '700' },
  permRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  permText: { flex: 1 },
});
