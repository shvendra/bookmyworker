import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../state/auth/AuthContext';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { AppText } from '../../../shared/components/ui/AppText';
import { useAppTheme } from '../../../core/theme';
import { useToast } from '../../../shared/state/toast/ToastContext';
import { teamApi } from '../../../core/api/endpoints/teamApi';
import { parseTeamSlug, isTeamIdentifier } from '../../../core/team/teamMode';
import { loginAsTeamMember } from '../services/teamAuthService';
import type { AuthStackParamList } from '../../../app/navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'TeamLogin'>;

/** Team member login: company link or code → company name shown → mobile → OTP. No password anywhere. */
export const TeamLoginScreen = ({ route, navigation }: Props): React.JSX.Element => {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const toast = useToast();
  const { t } = useTranslation('employer');

  const [linkText, setLinkText] = useState(route.params?.slug ?? '');
  const [company, setCompany] = useState<string | null>(null);
  const [active, setActive] = useState(true);
  const [checking, setChecking] = useState(false);
  const [ident, setIdent] = useState(''); // mobile number or email
  const [otp, setOtp] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const slug = parseTeamSlug(linkText);
  const identOk = isTeamIdentifier(ident);

  // Look the company up as soon as a valid link/code is entered, so the person sees WHICH company they are logging in to.
  useEffect(() => {
    setCompany(null);
    if (!slug) return undefined;
    let cancelled = false;
    setChecking(true);
    const handle = setTimeout(() => {
      void teamApi.publicLink(slug)
        .then((r) => { if (!cancelled) { setCompany(r.company); setActive(r.active); } })
        .catch(() => { if (!cancelled) setCompany(null); })
        .finally(() => { if (!cancelled) setChecking(false); });
    }, 400);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [slug]);

  const sendOtp = async (): Promise<void> => {
    setBusy(true);
    try { await teamApi.sendOtp(slug, ident.trim()); setSent(true); toast.success(t('team_otp_sent')); }
    catch (e) { toast.error((e as Error).message || t('team_otp_fail')); }
    finally { setBusy(false); }
  };
  const login = async (): Promise<void> => {
    setBusy(true);
    try { await signIn(await loginAsTeamMember(slug, ident.trim(), otp)); }
    catch (e) { toast.error((e as Error).message || t('team_login_fail')); setBusy(false); }
  };

  return (
    <KeyboardAvoidingView style={[s.root, { backgroundColor: theme.colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[s.body, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <AppText variant="caption" color={theme.colors.primary} style={s.kicker}>{t('team_login_kicker')}</AppText>
        <AppText variant="heading" color={theme.colors.text}>{company ?? t('team_login_title')}</AppText>
        <AppText variant="body" color={theme.colors.mutedText} style={s.sub}>
          {company ? (active ? t('team_login_sub_enter') : t('team_login_sub_inactive')) : t('team_login_sub_paste')}
        </AppText>

        <TextInput
          value={linkText} onChangeText={(v) => { setLinkText(v); setSent(false); setOtp(''); }} editable={!sent}
          autoCapitalize="none" autoCorrect={false} placeholder={t('team_link_ph')} placeholderTextColor={theme.colors.mutedText}
          style={[s.input, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
        />
        {checking && <AppText variant="caption" color={theme.colors.mutedText}>{t('team_checking')}</AppText>}
        {!!linkText && !slug && <AppText variant="caption" color={theme.colors.danger ?? '#DC2626'}>{t('team_err_not_link')}</AppText>}
        {!!slug && !checking && !company && <AppText variant="caption" color={theme.colors.danger ?? '#DC2626'}>{t('team_err_invalid')}</AppText>}

        {!!company && active && (
          <>
            <TextInput
              value={ident} onChangeText={(v) => setIdent(v.trim().slice(0, 120))} editable={!sent}
              keyboardType="email-address" autoCapitalize="none" autoCorrect={false} placeholder={t('team_ident_ph')} placeholderTextColor={theme.colors.mutedText}
              style={[s.input, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
            />
            {sent && (
              <TextInput
                value={otp} onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))} autoFocus
                keyboardType="number-pad" maxLength={6} placeholder={t('team_otp_ph')} placeholderTextColor={theme.colors.mutedText}
                style={[s.input, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
              />
            )}
            {!sent ? (
              <AppButton title={t('team_send_otp')} onPress={() => void sendOtp()} loading={busy} disabled={busy || !identOk} fullWidth />
            ) : (
              <>
                <AppButton title={t('team_login_btn')} onPress={() => void login()} loading={busy} disabled={busy || otp.length < 4} fullWidth />
                <AppButton title={t('team_change_otp')} variant="ghost" onPress={() => { setSent(false); setOtp(''); }} fullWidth />
              </>
            )}
            <AppText variant="caption" color={theme.colors.mutedText} center style={s.note}>
              {t('team_login_note', { company })}
            </AppText>
          </>
        )}
        <AppButton title={t('team_back_normal')} variant="ghost" onPress={() => navigation.goBack()} fullWidth />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const s = StyleSheet.create({
  root: { flex: 1 },
  body: { paddingHorizontal: 24, gap: 12 },
  kicker: { letterSpacing: 1.4, fontWeight: '700' },
  sub: { marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  note: { marginTop: 4 },
});
