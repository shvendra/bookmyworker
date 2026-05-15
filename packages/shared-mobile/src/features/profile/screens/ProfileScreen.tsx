import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppTheme } from '../../../core/theme';
import { useAuth } from '../../../state/auth/AuthContext';
import { AppText } from '../../../shared/components/ui/AppText';
import { Avatar } from '../../../shared/components/ui/Avatar';
import { GradientHeader } from '../../../shared/components/ui/GradientHeader';
import { useToast } from '../../../shared/state/toast/ToastContext';
import { LANGUAGE_OPTIONS } from '../../../core/i18n/translations';
import type { AppLanguage, KycStatus } from '../../../shared/types/domain';
import type { MainStackParamList } from '../../../app/navigation/types';

type ProfileNav = NativeStackNavigationProp<MainStackParamList>;

const kycStatusColor = (status: KycStatus, theme: ReturnType<typeof useAppTheme>['theme']) => {
  if (status === 'verified') return { bg: 'rgba(5,150,105,0.25)', text: '#4ADE80' };
  if (status === 'rejected') return { bg: 'rgba(220,38,38,0.25)', text: '#FCA5A5' };
  return { bg: 'rgba(217,119,6,0.25)', text: '#FCD34D' };
};

const FRONTEND_TO_BACKEND: Record<string, string> = {
  agent: 'Agent', employer: 'Employer', worker: 'SelfWorker',
  selfworker: 'SelfWorker', admin: 'Admin', superadmin: 'SuperAdmin',
};

interface MenuItemProps {
  icon: string;
  label: string;
  onPress: () => void;
  danger?: boolean;
  badge?: string;
  right?: React.ReactNode;
  isLast?: boolean;
}

const MenuItem = ({ icon, label, onPress, danger = false, badge, right, isLast = false }: MenuItemProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.65}
      style={[
        styles.menuItem,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.divider },
      ]}
    >
      <View
        style={[
          styles.menuIconWrap,
          { backgroundColor: danger ? theme.colors.dangerLight : theme.colors.primaryLight },
        ]}
      >
        <AppText style={styles.menuIcon}>{icon}</AppText>
      </View>
      <AppText
        variant="body"
        color={danger ? theme.colors.danger : theme.colors.text}
        style={styles.menuLabel}
      >
        {label}
      </AppText>
      {badge ? (
        <View style={[styles.menuBadge, { backgroundColor: theme.colors.danger }]}>
          <AppText variant="micro" color="#FFF" style={styles.menuBadgeText}>{badge}</AppText>
        </View>
      ) : null}
      {right ?? (
        <AppText style={[styles.menuChevron, { color: theme.colors.mutedText }]}>›</AppText>
      )}
    </TouchableOpacity>
  );
};

interface MenuSectionProps {
  label: string;
  children: React.ReactNode;
}

const MenuSection = ({ label, children }: MenuSectionProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.menuCard, { backgroundColor: theme.colors.card, borderColor: theme.mode === 'dark' ? theme.colors.border : '#EBF0F8' }, theme.shadow.sm]}>
      <AppText variant="micro" color={theme.colors.mutedText} style={styles.sectionLabel}>
        {label}
      </AppText>
      {children}
    </View>
  );
};

export const ProfileScreen = (): React.JSX.Element => {
  const { theme, setThemeMode } = useAppTheme();
  const { state, signOut, setLanguage } = useAuth();
  const navigation = useNavigation<ProfileNav>();
  const toast = useToast();
  const user = state.session?.user;
  const availableRoles = state.session?.availableRoles ?? [];
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [savingLang, setSavingLang] = useState(false);
  const [signOutModalVisible, setSignOutModalVisible] = useState(false);

  const currentLang = LANGUAGE_OPTIONS.find((l) => l.value === (user?.language ?? 'en'));
  const isDark = theme.mode === 'dark';
  const currentBackendRole = FRONTEND_TO_BACKEND[user?.role ?? ''] ?? (user?.role?.toUpperCase() ?? 'USER');
  const kycColors = kycStatusColor(user?.kycStatus ?? 'pending', theme);

  const handleSelectLanguage = async (lang: AppLanguage): Promise<void> => {
    setSavingLang(true);
    try {
      await setLanguage(lang);
      const label = LANGUAGE_OPTIONS.find((l) => l.value === lang)?.englishLabel ?? lang;
      toast.success(`Language changed to ${label}`);
    } catch {
      toast.error('Failed to update language. Please try again.');
    } finally {
      setSavingLang(false);
      setLangModalVisible(false);
    }
  };

  const handleSignOut = (): void => {
    setSignOutModalVisible(true);
  };

  const confirmSignOut = (): void => {
    setSignOutModalVisible(false);
    toast.info('Signing out…');
    setTimeout(() => { signOut(); }, 300);
  };

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Gradient Header — photo + name + status only */}
      <GradientHeader title="">
        <View style={styles.profileCenter}>
          <Avatar
            name={user?.fullName ?? 'U'}
            uri={user?.profileImage}
            size={88}
            ring
            ringColor="rgba(255,255,255,0.55)"
            online={user?.kycStatus === 'verified'}
          />
          <AppText style={styles.profileName}>
            {user?.fullName ?? 'User'}
          </AppText>
          <View style={[styles.statusPill, { backgroundColor: kycColors.bg }]}>
            <AppText style={[styles.statusPillTxt, { color: kycColors.text }]}>
              {(user?.kycStatus ?? 'PENDING').toUpperCase()}
            </AppText>
          </View>
        </View>
      </GradientHeader>

      <View style={styles.body}>
        {/* Switch Account — hidden for employer (single-role app) */}
        {user?.role !== 'employer' && (
          <TouchableOpacity
            onPress={() => navigation.navigate('SwitchAccount')}
            activeOpacity={0.8}
            style={[styles.switchCard, { backgroundColor: theme.colors.primary }, theme.shadow.md]}
          >
            <AppText style={styles.switchIcon}>🔄</AppText>
            <View style={styles.switchText}>
              <AppText variant="labelSm" color="#FFFFFF">Switch Account</AppText>
              <AppText variant="micro" color="rgba(255,255,255,0.75)">
                {availableRoles.length > 1
                  ? `${availableRoles.length} accounts · Active: ${currentBackendRole}`
                  : 'Manage your linked accounts'}
              </AppText>
            </View>
            <AppText style={[styles.switchArrow, { color: 'rgba(255,255,255,0.7)' }]}>›</AppText>
          </TouchableOpacity>
        )}

        {/* Account Section */}
        <MenuSection label="ACCOUNT">
          <MenuItem icon="👤" label="Edit Profile" onPress={() => navigation.navigate('EditProfile')} />
          <MenuItem
            icon="🪪"
            label="KYC Verification"
            onPress={() => navigation.navigate('KycVerification')}
            badge={user?.kycStatus === 'pending' ? '!' : undefined}
          />
          <MenuItem icon="🔔" label="Notifications" onPress={() => navigation.navigate('Notifications')} />
          <MenuItem icon="⚙️" label="Notification Settings" onPress={() => navigation.navigate('NotificationPreferences')} />
          <MenuItem
            icon="🌐"
            label={`Language · ${currentLang?.nativeLabel ?? 'English'}`}
            onPress={() => setLangModalVisible(true)}
            isLast
          />
        </MenuSection>

        {/* Appearance Section */}
        <MenuSection label="APPEARANCE">
          <MenuItem
            icon={isDark ? '🌙' : '☀️'}
            label={isDark ? 'Dark Mode' : 'Light Mode'}
            onPress={() => {}}
            isLast
            right={
              <Switch
                value={isDark}
                onValueChange={(val) => setThemeMode(val ? 'dark' : 'light')}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary + '88' }}
                thumbColor={isDark ? theme.colors.primary : '#FFFFFF'}
              />
            }
          />
        </MenuSection>

        {/* Workers Section — employer only */}
        {user?.role === 'employer' && (
          <MenuSection label="WORKERS">
            <MenuItem
              icon="👷"
              label="Browse Workers & Agents"
              onPress={() => navigation.navigate('WorkerSearch')}
              isLast
            />
          </MenuSection>
        )}

        {/* More Section */}
        <MenuSection label="MORE">
          <MenuItem icon="💬" label="Support & Help" onPress={() => navigation.navigate('Support')} />
          <MenuItem icon="⭐" label="Rate the App" onPress={() => {}} />
          <MenuItem icon="📄" label="Terms & Privacy" onPress={() => navigation.navigate('TermsPrivacy')} isLast />
        </MenuSection>

        {/* Sign Out */}
        <TouchableOpacity
          onPress={handleSignOut}
          activeOpacity={0.82}
          style={[styles.signOutBtn, { backgroundColor: theme.colors.dangerLight, borderColor: theme.colors.danger }]}
        >
          <AppText style={styles.signOutIcon}>🚪</AppText>
          <AppText variant="label" color={theme.colors.danger} style={styles.signOutText}>
            Sign Out
          </AppText>
        </TouchableOpacity>

        <AppText variant="micro" color={theme.colors.mutedText} style={styles.version}>
          BookMyWorkers v1.0.0
        </AppText>
      </View>

      {/* Language Modal */}
      <Modal
        visible={langModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setLangModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setLangModalVisible(false)}
        >
          <View
            style={[styles.modalSheet, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={[styles.modalHandle, { backgroundColor: theme.colors.border }]} />
            <AppText variant="heading" color={theme.colors.text} style={styles.modalTitle}>
              Choose Language
            </AppText>
            <AppText variant="caption" color={theme.colors.mutedText} style={styles.modalSub}>
              Select your preferred language
            </AppText>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.langGrid}>
                {LANGUAGE_OPTIONS.map((lang) => {
                  const isSelected = (user?.language ?? 'en') === lang.value;
                  return (
                    <TouchableOpacity
                      key={lang.value}
                      onPress={() => void handleSelectLanguage(lang.value as AppLanguage)}
                      disabled={savingLang}
                      activeOpacity={0.7}
                      style={[
                        styles.langChip,
                        {
                          backgroundColor: isSelected ? theme.colors.primary : theme.colors.background,
                          borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                          opacity: savingLang ? 0.6 : 1,
                        },
                      ]}
                    >
                      {isSelected ? (
                        <AppText style={styles.checkmark}>✓</AppText>
                      ) : null}
                      <AppText
                        variant="label"
                        color={isSelected ? '#FFFFFF' : theme.colors.text}
                        style={styles.langNative}
                      >
                        {lang.nativeLabel}
                      </AppText>
                      <AppText
                        variant="micro"
                        color={isSelected ? 'rgba(255,255,255,0.8)' : theme.colors.mutedText}
                        style={styles.langEnglish}
                      >
                        {lang.englishLabel}
                      </AppText>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Sign Out Confirmation Modal */}
      <Modal
        visible={signOutModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setSignOutModalVisible(false)}
      >
        <View style={styles.signOutOverlay}>
          <View style={[styles.signOutDialog, { backgroundColor: theme.colors.card }]}>
            <AppText style={styles.signOutEmoji}>🚪</AppText>
            <AppText variant="subtitle" style={styles.signOutTitle}>Sign Out?</AppText>
            <AppText variant="body" color={theme.colors.mutedText} style={styles.signOutMessage}>
              Are you sure you want to sign out of your account?
            </AppText>
            <View style={styles.signOutActions}>
              <TouchableOpacity
                onPress={() => setSignOutModalVisible(false)}
                style={[styles.signOutActionBtn, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                activeOpacity={0.8}
              >
                <AppText variant="label" color={theme.colors.text}>Cancel</AppText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmSignOut}
                style={[styles.signOutActionBtn, { backgroundColor: theme.colors.danger }]}
                activeOpacity={0.8}
              >
                <AppText variant="label" color="#FFFFFF">Sign Out</AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: 48 },

  // ── Profile header — centered photo / name / status ──────────────────────
  profileCenter: {
    alignItems: 'center',
    gap: 10,
    paddingBottom: 4,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  statusPillTxt: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  body: { padding: 16, gap: 12 },

  switchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  switchIcon: { fontSize: 24, lineHeight: 28 },
  switchText: { flex: 1, gap: 2 },
  switchArrow: { fontSize: 26, opacity: 0.8 },

  menuCard: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
  },
  sectionLabel: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    letterSpacing: 1,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIcon: { fontSize: 17, lineHeight: 20 },
  menuLabel: { flex: 1 },
  menuBadge: {
    borderRadius: 999,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  menuBadgeText: { fontWeight: '800' },
  menuChevron: { fontSize: 22, opacity: 0.4, lineHeight: 26 },

  signOutBtn: {
    borderRadius: 18,
    borderWidth: 1.5,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 4,
  },
  signOutIcon: { fontSize: 20, lineHeight: 24 },
  signOutText: { fontWeight: '700', fontSize: 16 },

  version: { textAlign: 'center', marginTop: 8 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingBottom: 44,
    paddingTop: 12,
    maxHeight: '75%',
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { marginBottom: 4 },
  modalSub: { marginBottom: 20 },
  langGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 8 },
  langChip: {
    width: '30%',
    flexGrow: 1,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 2,
  },
  checkmark: { fontSize: 12, fontWeight: '700', color: '#FFFFFF', marginBottom: 2 },
  langNative: { fontSize: 14, textAlign: 'center', fontWeight: '700' },
  langEnglish: { fontSize: 10, textAlign: 'center' },

  signOutOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  signOutDialog: {
    width: '100%',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  signOutEmoji: { fontSize: 40, lineHeight: 48, marginBottom: 4 },
  signOutTitle: { fontWeight: '700', textAlign: 'center' },
  signOutMessage: { textAlign: 'center', lineHeight: 22, marginTop: 4 },
  signOutActions: { flexDirection: 'row', gap: 12, marginTop: 16, width: '100%' },
  signOutActionBtn: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
});
