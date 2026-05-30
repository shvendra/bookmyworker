import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  View,
  ActivityIndicator,
} from 'react-native';
import { showAlert } from '../../../shared/state/alert/AppAlertContext';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAppTheme } from '../../../core/theme';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppCard } from '../../../shared/components/ui/AppCard';
import { notificationApi, type NotificationPreferences } from '../../../core/api/endpoints/notificationApi';

const DEFAULT_PREFS: NotificationPreferences = {
  newRequirement: true,
  expressedInterest: true,
  paymentSuccess: true,
  payoutApproved: true,
  kycUpdate: true,
  chat: true,
  promotions: true,
  newWorkerInState: true,
  callOutcome: true,
};

interface PrefRow {
  key: keyof NotificationPreferences;
  label: string;
  description: string;
}

const AGENT_PREF_ROWS: PrefRow[] = [
  { key: 'newRequirement',   label: 'New Requirements',    description: 'When an employer posts a new job requirement' },
  { key: 'kycUpdate',        label: 'KYC Status',          description: 'When your KYC verification status changes' },
  { key: 'chat',             label: 'Chat Messages',       description: 'New messages in your conversations' },
  { key: 'promotions',       label: 'Promotions & Updates',description: 'Offers, tips, and platform announcements' },
];

const EMPLOYER_PREF_ROWS: PrefRow[] = [
  { key: 'callOutcome',      label: 'Call Outcome Updates',description: 'When an employer updates the outcome of a call with you' },
  { key: 'expressedInterest',label: 'Interest Expressed',  description: 'When a worker shows interest in your requirement' },
  { key: 'kycUpdate',        label: 'KYC Status',          description: 'When your KYC verification status changes' },
  { key: 'chat',             label: 'Chat Messages',       description: 'New messages in your conversations' },
  { key: 'promotions',       label: 'Promotions & Updates',description: 'Offers, tips, and platform announcements' },
];

export const NotificationPreferencesScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const appType = (route.params as { appType?: string } | undefined)?.appType;
  const PREF_ROWS = appType === 'agent' ? AGENT_PREF_ROWS : EMPLOYER_PREF_ROWS;

  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<keyof NotificationPreferences | null>(null);

  useEffect(() => {
    void loadPrefs();
  }, []);

  const loadPrefs = async (): Promise<void> => {
    try {
      const res = await notificationApi.getPreferences();
      setPrefs({ ...DEFAULT_PREFS, ...res.preferences });
    } catch {
      // Use defaults if fetch fails
    } finally {
      setLoading(false);
    }
  };

  const toggle = async (key: keyof NotificationPreferences): Promise<void> => {
    const newVal = !prefs[key];
    setPrefs((p) => ({ ...p, [key]: newVal }));
    setSaving(key);
    try {
      await notificationApi.savePreferences({ [key]: newVal });
    } catch {
      setPrefs((p) => ({ ...p, [key]: !newVal }));
      showAlert('Error', 'Failed to update preference. Please try again.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor="#1037A4" />
      <ScreenHeader title="Notification Preferences" onBack={() => navigation.goBack()} />
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <AppText variant="title">Notification Preferences</AppText>
        <AppText variant="body" color={theme.colors.mutedText} style={styles.subtitle}>
          Choose which notifications you want to receive.
        </AppText>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.colors.primary} style={styles.loader} />
      ) : (
        <AppCard style={styles.card}>
          {PREF_ROWS.map((row, index) => (
            <View
              key={row.key}
              style={[
                styles.row,
                index < PREF_ROWS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
              ]}
            >
              <View style={styles.rowText}>
                <AppText variant="label">{row.label}</AppText>
                <AppText variant="caption" color={theme.colors.mutedText} style={styles.desc}>
                  {row.description}
                </AppText>
              </View>
              <Switch
                value={prefs[row.key]}
                onValueChange={() => void toggle(row.key)}
                disabled={saving === row.key}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary + '80' }}
                thumbColor={prefs[row.key] ? theme.colors.primary : theme.colors.mutedText}
              />
            </View>
          ))}
        </AppCard>
      )}

      <AppText variant="caption" color={theme.colors.mutedText} style={styles.note}>
        Changes are saved immediately. You can update these anytime.
      </AppText>
    </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  header: { marginBottom: 20 },
  subtitle: { marginTop: 6 },
  loader: { marginTop: 40 },
  card: { padding: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  rowText: { flex: 1 },
  desc: { marginTop: 2 },
  note: { textAlign: 'center', marginTop: 20, paddingHorizontal: 16 },
});
