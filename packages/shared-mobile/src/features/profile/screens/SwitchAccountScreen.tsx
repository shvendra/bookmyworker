import React, { useState } from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { showAlert } from '../../../shared/state/alert/AppAlertContext';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../../../core/theme';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { useAuth } from '../../../state/auth/AuthContext';
import { AppText } from '../../../shared/components/ui/AppText';

const ROLE_META: Record<string, { label: string; icon: string; color: string; description: string }> = {
  Agent:      { label: 'Agent',       icon: '🤝', color: '#4361EE', description: 'Register workers, earn commissions' },
  Employer:   { label: 'Employer',    icon: '💼', color: '#7C3AED', description: 'Post requirements, hire workers' },
  SelfWorker: { label: 'Job Seeker',  icon: '👷', color: '#2DC87B', description: 'Find jobs, track applications' },
  Worker:     { label: 'Worker',      icon: '🔧', color: '#FF9B3E', description: 'View assignments and attendance' },
  Admin:      { label: 'Admin',       icon: '🛡️', color: '#FF4D4F', description: 'Manage platform users' },
  SuperAdmin: { label: 'Super Admin', icon: '👑', color: '#F59E0B', description: 'Full platform administration' },
};

const FRONTEND_TO_BACKEND: Record<string, string> = {
  agent: 'Agent', employer: 'Employer', worker: 'SelfWorker',
  admin: 'Admin', superadmin: 'SuperAdmin',
};

export const SwitchAccountScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const navigation = useNavigation();
  const { state, switchRole, setDefaultRole } = useAuth();
  const availableRoles = state.session?.availableRoles ?? [];
  const currentBackendRole = FRONTEND_TO_BACKEND[state.session?.user?.role ?? ''] ?? '';
  const defaultRole = state.session?.defaultRole ?? '';
  const [switching, setSwitching] = useState<string | null>(null);
  const [settingDefault, setSettingDefault] = useState<string | null>(null);

  const handleSwitch = async (backendRole: string): Promise<void> => {
    if (backendRole === currentBackendRole) return;
    setSwitching(backendRole);
    try {
      await switchRole(backendRole);
      navigation.goBack();
    } catch (e) {
      showAlert('Switch Failed', e instanceof Error ? e.message : 'Could not switch account. Please try again.');
      setSwitching(null);
    }
  };

  const handleSetDefault = async (backendRole: string): Promise<void> => {
    setSettingDefault(backendRole);
    try {
      await setDefaultRole(backendRole);
      showAlert('Default Set', `${ROLE_META[backendRole]?.label ?? backendRole} is now your default account. It will open automatically on next login.`);
    } catch (e) {
      showAlert('Error', e instanceof Error ? e.message : 'Could not set default. Please try again.');
    } finally {
      setSettingDefault(null);
    }
  };

  const isDark = theme.mode === 'dark';

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor="#1037A4" />
      <ScreenHeader title="Switch Account" onBack={() => navigation.goBack()} />
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <AppText variant="title" style={styles.title}>Switch Account</AppText>
      <AppText variant="body" color={theme.colors.mutedText} style={styles.subtitle}>
        You have {availableRoles.length} account{availableRoles.length !== 1 ? 's' : ''} registered with this phone number. Tap to switch.
      </AppText>

      {availableRoles.length === 0 && (
        <View style={[styles.emptyCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <AppText style={styles.emptyIcon}>📱</AppText>
          <AppText variant="label" style={styles.emptyTitle}>No other accounts found</AppText>
          <AppText variant="body" color={theme.colors.mutedText} style={styles.emptyMsg}>
            Register with the same phone number under a different role to see them here.
          </AppText>
        </View>
      )}

      <View style={styles.roleList}>
        {availableRoles.map((backendRole) => {
          const meta = ROLE_META[backendRole] ?? { label: backendRole, icon: '👤', color: theme.colors.primary, description: '' };
          const isActive = backendRole === currentBackendRole;
          const isDefault = backendRole === defaultRole;
          const isSwitching = switching === backendRole;
          const isSettingDefault = settingDefault === backendRole;
          const busy = switching !== null || settingDefault !== null;

          return (
            <TouchableOpacity
              key={backendRole}
              onPress={() => void handleSwitch(backendRole)}
              disabled={busy || isActive}
              activeOpacity={0.75}
              style={[
                styles.roleCard,
                {
                  backgroundColor: isActive
                    ? meta.color
                    : isDark ? theme.colors.card : theme.colors.surface,
                  borderColor: isActive ? meta.color : theme.colors.border,
                  ...(isActive ? {} : theme.shadow.md),
                },
              ]}
            >
              {/* Left accent bar */}
              {!isActive && (
                <View style={[styles.accentBar, { backgroundColor: meta.color }]} />
              )}

              <View style={[styles.roleIconWrap, { backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : meta.color + '18' }]}>
                <AppText style={styles.roleIcon}>{meta.icon}</AppText>
              </View>

              <View style={styles.roleInfo}>
                <View style={styles.roleNameRow}>
                  <AppText
                    variant="label"
                    color={isActive ? '#FFFFFF' : theme.colors.text}
                    style={styles.roleName}
                  >
                    {meta.label}
                  </AppText>
                  {isActive && (
                    <View style={styles.activePill}>
                      <AppText variant="caption" color="#FFFFFF" style={styles.activePillText}>
                        ✓  Active
                      </AppText>
                    </View>
                  )}
                  {isDefault && (
                    <View style={[styles.defaultPill, { backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : meta.color + '22', borderColor: isActive ? 'rgba(255,255,255,0.4)' : meta.color + '55' }]}>
                      <AppText variant="caption" color={isActive ? '#FFFFFF' : meta.color} style={styles.activePillText}>
                        ⭐ Default
                      </AppText>
                    </View>
                  )}
                </View>
                <AppText
                  variant="caption"
                  color={isActive ? 'rgba(255,255,255,0.8)' : theme.colors.mutedText}
                >
                  {meta.description}
                </AppText>
                {/* Set as default button */}
                {!isDefault && (
                  <TouchableOpacity
                    onPress={() => void handleSetDefault(backendRole)}
                    disabled={busy}
                    style={[styles.setDefaultBtn, { borderColor: isActive ? 'rgba(255,255,255,0.4)' : meta.color + '55' }]}
                    activeOpacity={0.7}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    {isSettingDefault ? (
                      <ActivityIndicator size="small" color={isActive ? '#FFF' : meta.color} />
                    ) : (
                      <AppText variant="caption" color={isActive ? 'rgba(255,255,255,0.85)' : meta.color} style={styles.setDefaultText}>
                        Set as default login
                      </AppText>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              {isSwitching ? (
                <ActivityIndicator color={isActive ? '#FFF' : meta.color} />
              ) : !isActive ? (
                <AppText variant="body" color={meta.color} style={styles.switchArrow}>›</AppText>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={[styles.infoBox, { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary + '30' }]}>
        <AppText variant="caption" color={theme.colors.primary} style={styles.infoText}>
          💡  Switching accounts keeps you logged in — your data and settings for each role are separate.
        </AppText>
      </View>
    </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 48 },
  title: { marginBottom: 8 },
  subtitle: { marginBottom: 24, lineHeight: 22 },
  roleList: { gap: 12, marginBottom: 24 },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 14,
    overflow: 'hidden',
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
  },
  roleIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIcon: { fontSize: 26 },
  roleInfo: { flex: 1, gap: 4 },
  roleNameRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  roleName: { fontSize: 16, fontWeight: '700' },
  activePill: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  defaultPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  activePillText: { fontWeight: '700', fontSize: 11 },
  setDefaultBtn: {
    alignSelf: 'flex-start',
    marginTop: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    minHeight: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setDefaultText: { fontWeight: '600', fontSize: 10 },
  switchArrow: { fontSize: 26, fontWeight: '300', opacity: 0.6 },
  emptyCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 28,
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { marginBottom: 8 },
  emptyMsg: { textAlign: 'center', lineHeight: 22 },
  infoBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  infoText: { lineHeight: 20 },
});
