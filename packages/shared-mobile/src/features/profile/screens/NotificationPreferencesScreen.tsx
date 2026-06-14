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
import { useTranslation } from 'react-i18next';
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
  labelKey: string;
  descKey: string;
}

const AGENT_PREF_ROWS: PrefRow[] = [
  { key: 'newRequirement',   labelKey: 'notifPrefNewReqLabel',     descKey: 'notifPrefNewReqDesc' },
  { key: 'kycUpdate',        labelKey: 'notifPrefKycLabel',        descKey: 'notifPrefKycDesc' },
  { key: 'chat',             labelKey: 'notifPrefChatLabel',       descKey: 'notifPrefChatDesc' },
  { key: 'promotions',       labelKey: 'notifPrefPromoLabel',      descKey: 'notifPrefPromoDesc' },
];

// Employer notification categories — kept in sync with the CRM
// (NotificationSettings.jsx → Employer set). `callOutcome` is intentionally
// excluded: it is a WORKER-facing notification (sent to the worker when an
// employer logs a call outcome), so it is meaningless in an employer's own prefs.
const EMPLOYER_PREF_ROWS: PrefRow[] = [
  { key: 'expressedInterest',labelKey: 'notifPrefInterestLabel',   descKey: 'notifPrefInterestDesc' },
  { key: 'paymentSuccess',   labelKey: 'notifPrefPaymentLabel',    descKey: 'notifPrefPaymentDesc' },
  { key: 'kycUpdate',        labelKey: 'notifPrefKycLabel',        descKey: 'notifPrefKycDesc' },
  { key: 'chat',             labelKey: 'notifPrefChatLabel',       descKey: 'notifPrefChatDesc' },
  { key: 'promotions',       labelKey: 'notifPrefPromoLabel',      descKey: 'notifPrefPromoDesc' },
];

export const NotificationPreferencesScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation();
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
      showAlert(t('alertError'), t('notifPrefUpdateError'));
    } finally {
      setSaving(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor="#1037A4" />
      <ScreenHeader title={t('notifPrefTitle')} onBack={() => navigation.goBack()} />
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <AppText variant="body" color={theme.colors.mutedText} style={styles.subtitle}>
          {t('notifPrefSubtitle')}
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
                <AppText variant="label">{t(row.labelKey)}</AppText>
                <AppText variant="caption" color={theme.colors.mutedText} style={styles.desc}>
                  {t(row.descKey)}
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
        {t('notifPrefSavedNote')}
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
