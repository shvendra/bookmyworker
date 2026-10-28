import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../state/auth/AuthContext';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { AppText } from '../../../shared/components/ui/AppText';
import { useAppTheme } from '../../../core/theme';
import { useToast } from '../../../shared/state/toast/ToastContext';
import { teamApi } from '../../../core/api/endpoints/teamApi';
import { parseTeamSlug } from '../../../core/team/teamMode';
import { loginAsTeamMember } from '../services/teamAuthService';
import type { AuthStackParamList } from '../../../app/navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'TeamLogin'>;

/** Team member login: company link or code → company name shown → mobile → OTP. No password anywhere. */
export const TeamLoginScreen = ({ route, navigation }: Props): React.JSX.Element => {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const toast = useToast();

  const [linkText, setLinkText] = useState(route.params?.slug ?? '');
  const [company, setCompany] = useState<string | null>(null);
  const [active, setActive] = useState(true);
  const [checking, setChecking] = useState(false);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const slug = parseTeamSlug(linkText);

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
    try { await teamApi.sendOtp(slug, phone); setSent(true); toast.success('OTP sent'); }
    catch (e) { toast.error((e as Error).message || 'Could not send the OTP.'); }
    finally { setBusy(false); }
  };
  const login = async (): Promise<void> => {
    setBusy(true);
    try { await signIn(await loginAsTeamMember(slug, phone, otp)); }
    catch (e) { toast.error((e as Error).message || 'Login failed.'); setBusy(false); }
  };

  return (
    <KeyboardAvoidingView style={[s.root, { backgroundColor: theme.colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[s.body, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <AppText variant="caption" color={theme.colors.primary} style={s.kicker}>TEAM LOGIN</AppText>
        <AppText variant="heading" color={theme.colors.text}>{company ?? 'Log in to your company team'}</AppText>
        <AppText variant="body" color={theme.colors.mutedText} style={s.sub}>
          {company ? (active ? 'Enter your mobile number to continue.' : 'Team login is not available for this company right now.') : 'Paste the team link your employer sent you (or its code).'}
        </AppText>

        <TextInput
          value={linkText} onChangeText={(v) => { setLinkText(v); setSent(false); setOtp(''); }} editable={!sent}
          autoCapitalize="none" autoCorrect={false} placeholder="Team link or code" placeholderTextColor={theme.colors.mutedText}
          style={[s.input, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
        />
        {checking && <AppText variant="caption" color={theme.colors.mutedText}>Checking…</AppText>}
        {!!linkText && !slug && <AppText variant="caption" color={theme.colors.danger ?? '#DC2626'}>That doesn't look like a team link.</AppText>}
        {!!slug && !checking && !company && <AppText variant="caption" color={theme.colors.danger ?? '#DC2626'}>This team link is not valid.</AppText>}

        {!!company && active && (
          <>
            <TextInput
              value={phone} onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))} editable={!sent}
              keyboardType="number-pad" maxLength={10} placeholder="Mobile number" placeholderTextColor={theme.colors.mutedText}
              style={[s.input, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
            />
            {sent && (
              <TextInput
                value={otp} onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))} autoFocus
                keyboardType="number-pad" maxLength={6} placeholder="OTP" placeholderTextColor={theme.colors.mutedText}
                style={[s.input, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
              />
            )}
            {!sent ? (
              <AppButton title="Send OTP" onPress={() => void sendOtp()} loading={busy} disabled={busy || phone.length !== 10} fullWidth />
            ) : (
              <>
                <AppButton title="Login" onPress={() => void login()} loading={busy} disabled={busy || otp.length < 4} fullWidth />
                <AppButton title="Change number / resend OTP" variant="ghost" onPress={() => { setSent(false); setOtp(''); }} fullWidth />
              </>
            )}
            <AppText variant="caption" color={theme.colors.mutedText} center style={s.note}>
              Only numbers added by {company} can log in. This does not affect your personal BookMyWorker account.
            </AppText>
          </>
        )}
        <AppButton title="Back to normal login" variant="ghost" onPress={() => navigation.goBack()} fullWidth />
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
