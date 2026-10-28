import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Share, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { AppText } from '../../../shared/components/ui/AppText';
import { useAppTheme } from '../../../core/theme';
import { useToast } from '../../../shared/state/toast/ToastContext';
import { nextPermissions, isRequiredByOther, groupPermissions, permKey, groupKey } from '../teamEligibility';
import { teamApi, teamLinkUrl, type TeamActivityRow, type TeamMember, type TeamOverview, type TeamPermission } from '../../../core/api/endpoints/teamApi';

const validEmail = (v: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
const whenText = (d: string | null | undefined, never: string): string => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : never);

interface DialogProps { visible: boolean; member: TeamMember | null; catalog: TeamPermission[]; onClose: () => void; onSaved: () => void }

const MemberDialog = ({ visible, member, catalog, onClose, onSaved }: DialogProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
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
        if (r.emailSent === false) toast.error(t('team_t_email_failed'));
      }
      toast.success(editing ? t('team_t_updated') : t('team_t_added'));
      onSaved();
    } catch (e) { toast.error((e as Error).message || t('team_t_save_fail')); }
    finally { setSaving(false); }
  };

  const valid = name.trim().length >= 2 && perms.length > 0 && validEmail(email) && (editing || phone.length === 10);
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.scrim}>
        <ScrollView style={s.sheetScroll} contentContainerStyle={[s.sheet, { backgroundColor: theme.colors.surface }]} keyboardShouldPersistTaps="handled">
          <AppText variant="heading" color={theme.colors.text}>{editing ? t('team_edit_member') : t('team_add_member')}</AppText>
          <TextInput value={name} onChangeText={setName} placeholder={t('team_ph_name')} placeholderTextColor={theme.colors.mutedText}
            style={[s.input, { color: theme.colors.text, borderColor: theme.colors.border }]} />
          <TextInput value={phone} onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))} editable={!editing} keyboardType="number-pad" maxLength={10}
            placeholder={t('team_ph_mobile')} placeholderTextColor={theme.colors.mutedText}
            style={[s.input, { color: theme.colors.text, borderColor: theme.colors.border, opacity: editing ? 0.6 : 1 }]} />
          <TextInput value={email} onChangeText={(v) => setEmail(v.trim().slice(0, 120))} keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
            placeholder={t('team_ph_email')} placeholderTextColor={theme.colors.mutedText}
            style={[s.input, { color: theme.colors.text, borderColor: !email || validEmail(email) ? theme.colors.border : '#DC2626' }]} />
          <AppText variant="label" color={theme.colors.text}>{t('team_what_can')}</AppText>
          {groupPermissions(catalog).map((g) => (
            <View key={g.name} style={s.group}>
              <AppText variant="caption" color={theme.colors.mutedText} style={s.groupName}>{t(groupKey(g.name), { defaultValue: g.name }).toUpperCase()}</AppText>
              {g.items.map((p) => (
                <View key={p.key} style={s.permRow}>
                  <View style={s.permText}>
                    <AppText variant="body" color={theme.colors.text}>{t(`${permKey(p.key)}_label`, { defaultValue: p.label })}</AppText>
                    <AppText variant="caption" color={theme.colors.mutedText}>{t(`${permKey(p.key)}_desc`, { defaultValue: p.desc })}</AppText>
                  </View>
                  <Switch value={perms.includes(p.key)} disabled={isRequiredByOther(perms, p.key)} onValueChange={() => setPerms((c) => nextPermissions(c, p.key))} />
                </View>
              ))}
            </View>
          ))}
          <View style={s.btnRow}>
            <AppButton title={t('cancel')} variant="ghost" onPress={onClose} style={s.flex} />
            <AppButton title={editing ? t('save') : t('team_add_send')} onPress={() => void save()} loading={saving} disabled={!valid || saving} style={s.flex} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

/** Owner screen: give staff their own login to work for you, choose what they may do, see what they did. */
export const MyTeamScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
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
    } catch (e) { setError((e as Error).message || t('team_t_load_fail')); }
  }, [t]);
  useEffect(() => { void load(); }, [load]);

  const run = async (fn: () => Promise<unknown>, ok: string): Promise<void> => {
    try { await fn(); toast.success(ok); await load(); } catch (e) { toast.error((e as Error).message || t('team_t_action_fail')); }
  };
  const confirm = (title: string, message: string, action: string, onYes: () => void, destructive = false): void =>
    Alert.alert(title, message, [{ text: t('cancel'), style: 'cancel' }, { text: action, style: destructive ? 'destructive' : 'default', onPress: onYes }]);

  const pause = (m: TeamMember): void => {
    const pausing = m.status === 'active';
    const go = (): void => void run(() => teamApi.updateMember(m._id, { status: pausing ? 'suspended' : 'active' }), pausing ? t('team_act_member_paused') : t('team_act_member_resumed'));
    if (pausing) confirm(t('team_pause_title', { name: m.name }), t('team_pause_msg'), t('team_pause'), go); else go();
  };
  const remove = (m: TeamMember): void =>
    confirm(t('team_remove_title', { name: m.name }), t('team_remove_msg'), t('team_remove'), () => void run(() => teamApi.removeMember(m._id), t('team_removed')), true);
  const resend = (m: TeamMember): void => void run(() => teamApi.resendInvite(m._id), t('team_t_invite_sent', { email: m.email }));
  const rotate = (): void =>
    confirm(t('team_newlink_title'), t('team_newlink_msg'), t('team_new_link'), () => void run(() => teamApi.rotateLink(), t('team_t_new_link')));
  const share = (): void => {
    if (!data?.link) return;
    void Share.share({ message: t('team_share_msg', { company: data.company, link: teamLinkUrl(data.link.slug) }) });
  };

  if (error) return <View style={[s.center, { backgroundColor: theme.colors.background }]}><AppText variant="body" color={theme.colors.mutedText} center>{error}</AppText><AppButton title={t('retry')} onPress={() => void load()} /></View>;
  if (!data) return <View style={[s.center, { backgroundColor: theme.colors.background }]}><ActivityIndicator /></View>;

  const full = data.seats.used >= data.seats.limit;
  const permLabel = (k: string): string => t(`${permKey(k)}_label`, { defaultValue: data.permissions.find((p) => p.key === k)?.label ?? k });
  const actLabel = (a: string): string => t(`team_act_${a}`, { defaultValue: a });
  const removedBy = (by?: string): string => (by === 'owner' ? t('team_removed_you') : by === 'self' ? t('team_left_self') : by === 'admin' ? t('team_act_admin_removed') : t('team_removed'));
  const when = (d?: string | null): string => whenText(d, t('team_never'));

  return (
    <View style={[s.root, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24, gap: 14 }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}><AppText variant="label" color={theme.colors.primary}>← {t('back')}</AppText></Pressable>
        <AppText variant="heading" color={theme.colors.text}>{t('team_my_title')}</AppText>
        <AppText variant="body" color={theme.colors.mutedText}>{t('team_my_intro', { company: data.company })}</AppText>

        {!data.eligibility.eligible && (
          <View style={[s.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
            <AppText variant="body" color={theme.colors.text}>{data.eligibility.message}</AppText>
          </View>
        )}

        {data.link && data.eligibility.eligible && (
          <View style={[s.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
            <AppText variant="label" color={theme.colors.text}>{t('team_link_title')}</AppText>
            <AppText variant="caption" color={theme.colors.mutedText} selectable>{teamLinkUrl(data.link.slug)}</AppText>
            <View style={s.btnRow}>
              <AppButton title={t('team_share_link')} size="sm" onPress={share} style={s.flex} />
              <AppButton title={t('team_new_link')} size="sm" variant="outline" onPress={rotate} style={s.flex} />
            </View>
            <AppText variant="caption" color={theme.colors.mutedText}>{t('team_link_note', { company: data.company })}</AppText>
          </View>
        )}

        <View style={[s.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
          <View style={s.headRow}>
            <AppText variant="label" color={theme.colors.text}>{t('team_members_count', { used: data.seats.used, limit: data.seats.limit })}</AppText>
            <AppButton title={t('team_add')} size="sm" disabled={!data.eligibility.eligible || full} onPress={() => setDialog({ visible: true, member: null })} />
          </View>
          {full && data.eligibility.eligible && <AppText variant="caption" color={theme.colors.mutedText}>{t('team_seats_full')}</AppText>}
          {!data.members.length && <AppText variant="body" color={theme.colors.mutedText}>{t('team_no_members')}</AppText>}
          {data.members.map((m) => (
            <View key={m._id} style={[s.member, { borderTopColor: theme.colors.border }]}>
              <AppText variant="label" color={theme.colors.text}>{m.name}{m.status === 'suspended' ? `  ·  ${t('team_act_member_paused')}` : ''}</AppText>
              <AppText variant="caption" color={theme.colors.mutedText}>{m.phone}{m.email ? ` · ${m.email}` : ` · ${t('team_no_email')}`}</AppText>
              <AppText variant="caption" color={theme.colors.mutedText}>{t('team_last_login', { time: when(m.lastLoginAt) })}</AppText>
              <AppText variant="caption" color={theme.colors.primary}>{m.permissions.map(permLabel).join(' · ')}</AppText>
              <View style={s.btnRow}>
                {!!m.email && <AppButton title={t('team_email_link')} size="xs" variant="outline" onPress={() => resend(m)} />}
                <AppButton title={t('team_edit')} size="xs" variant="outline" onPress={() => setDialog({ visible: true, member: m })} />
                <AppButton title={m.status === 'active' ? t('team_pause') : t('team_resume')} size="xs" variant="outline" onPress={() => pause(m)} />
                <AppButton title={t('team_remove')} size="xs" variant="danger" onPress={() => remove(m)} />
              </View>
            </View>
          ))}
        </View>

        {!!data.former?.length && (
          <View style={[s.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
            <AppText variant="label" color={theme.colors.text}>{t('team_former')}</AppText>
            {data.former.map((m) => (
              <View key={m._id} style={[s.actRow, { borderTopColor: theme.colors.border }]}>
                <View style={s.flex}>
                  <AppText variant="caption" color={theme.colors.text}>{m.name}</AppText>
                  <AppText variant="caption" color={theme.colors.mutedText}>{m.phone}{m.email ? ` · ${m.email}` : ''}</AppText>
                </View>
                <View>
                  <AppText variant="caption" color={theme.colors.text}>{removedBy(m.removedBy)}</AppText>
                  <AppText variant="caption" color={theme.colors.mutedText}>{when(m.removedAt)}</AppText>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={[s.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
          <AppText variant="label" color={theme.colors.text}>{t('team_activity_title')}</AppText>
          {!activity.length && <AppText variant="caption" color={theme.colors.mutedText}>{t('team_nothing_yet')}</AppText>}
          {activity.map((a) => (
            <View key={a._id} style={[s.actRow, { borderTopColor: theme.colors.border }]}>
              <AppText variant="caption" color={theme.colors.text} style={s.flex}>{a.memberName} — {actLabel(a.action)}</AppText>
              <AppText variant="caption" color={theme.colors.mutedText}>{when(a.at)}</AppText>
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
