import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { certificateApi } from '../../../core/api/endpoints/certificateApi';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../../core/theme';
import { useAuth } from '../../../state/auth/AuthContext';
import { apiClient } from '../../../core/api/client';
import { AppText } from '../../../shared/components/ui/AppText';
import { Avatar } from '../../../shared/components/ui/Avatar';
import { ProfileCompletenessCard, type CompletenessField } from '../../../shared/components/ui/ProfileCompletenessCard';
import { VerifiedBadgeModal } from '../../../shared/components/ui/VerifiedBadgeModal';
import { useToast } from '../../../shared/state/toast/ToastContext';
import { usePricingConfig } from '../../../core/api/endpoints/pricingApi';
import { LANGUAGE_OPTIONS } from '../../../core/i18n/translations';
import { useTranslation } from 'react-i18next';
import type { AppLanguage, KycStatus } from '../../../shared/types/domain';
import type { MainStackParamList } from '../../../app/navigation/types';
import i18n from '../../../core/i18n';
import { getLocationStr } from '../../../shared/utils/labelUtils';
import { workerNeedsEducationDoc, hasEducationDoc } from '../../../shared/utils/workerProfileUtils';

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
  icon: keyof typeof Ionicons.glyphMap;
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
        <Ionicons name={icon} size={19} color={danger ? theme.colors.danger : theme.colors.primary} />
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
  const { t } = useTranslation();
  const { theme, setThemeMode } = useAppTheme();
  const { state, signOut, setLanguage } = useAuth();
  const navigation = useNavigation<ProfileNav>();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const user = state.session?.user;
  const availableRoles = state.session?.availableRoles ?? [];
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [savingLang, setSavingLang] = useState(false);
  const [signOutModalVisible, setSignOutModalVisible] = useState(false);
  const [verifiedModalVisible, setVerifiedModalVisible] = useState(false);
  const [deleteAccountModalVisible, setDeleteAccountModalVisible] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
const [showDeleteSection, setShowDeleteSection] = useState(false);
  const { pricing } = usePricingConfig();

  // Fetch user's certificates & labour licence for inline display on profile
  const showCerts = user?.role === 'worker' || user?.role === 'selfworker' || user?.role === 'agent';
  const { data: certData } = useQuery({
    queryKey: ['user-certificates'],
    queryFn: () => certificateApi.getAll(),
    staleTime: 60_000,
    enabled: showCerts,
  });
  const certificates   = certData?.certificates ?? [];
  const licenceUrl     = certData?.labourLicenceUrl ?? null;

  const currentLang = LANGUAGE_OPTIONS.find((l) => l.value === (user?.language ?? 'en'));
  const isDark = theme.mode === 'dark';
  const currentBackendRole = FRONTEND_TO_BACKEND[user?.role ?? ''] ?? (user?.role?.toUpperCase() ?? 'USER');
  const kycColors = kycStatusColor(user?.kycStatus ?? 'pending', theme);

  // ── Profile-strength card ───────────────────────────────────────────────────
  // Lives here, just below the profile photo. The field set differs by role:
  //   • employer → name/phone/email/state/district/employer-type/photo/KYC/subscription
  //     (matches the CRM + dashboard badge exactly; KYC counts via GST/firm for
  //      Industry employers, so no Aadhaar is required)
  //   • agent / worker / selfworker → leaner set (no email/employer-type/sub)
  const roleLower = (user?.role ?? '').toLowerCase();
  const isEmployer = roleLower === 'employer';
  const showCompleteness =
    isEmployer || roleLower === 'agent' || roleLower === 'worker' || roleLower === 'selfworker';

  // Employer-only: pull the full profile (subscription, KYC, employer-type) so the
  // completeness % matches the dashboard avatar badge exactly. Shares the same
  // query key as the dashboard, so the cache is reused (no extra round-trip).
  const empProfileQuery = useQuery({
    queryKey: ['employer-full-profile'],
    queryFn: async () => {
      const res = await apiClient.get<{
        user?: {
          isSubscribed?: boolean;
          subscriptionExpery?: string;
          status?: string;
          employerType?: string;
          profilePhoto?: string;
          kyc?: { firmName?: string; gstNumber?: string };
        };
      }>('/api/v1/user/getuser');
      return res.data.user ?? null;
    },
    staleTime: 60 * 1000,
    enabled: isEmployer,
  });
  const empProfile = empProfileQuery.data;
  const empIsSubscribed =
    !!empProfile?.isSubscribed &&
    (!empProfile.subscriptionExpery || new Date(empProfile.subscriptionExpery).getTime() > Date.now());

  const completenessFields = useMemo<CompletenessField[]>(() => {
    if (isEmployer) {
      const kyc = (empProfile?.kyc ?? {}) as { gstNumber?: string; firmName?: string };
      const hasKyc = !!(
        kyc.gstNumber || kyc.firmName || empProfile?.status === 'approved' || empProfile?.status === 'verified'
      );
      return [
        { key: 'name',     label: t('pf_name'),         done: !!user?.fullName?.trim() },
        { key: 'phone',    label: t('pf_phone'),        done: !!user?.phone },
        { key: 'email',    label: t('pf_email'),        done: !!user?.email?.trim() },
        { key: 'state',    label: t('pf_state'),        done: !!user?.state?.trim() },
        { key: 'district', label: t('pf_district'),     done: !!user?.district?.trim() },
        { key: 'photo',    label: t('pf_photo'),        done: !!(user?.profileImage || empProfile?.profilePhoto) },
        { key: 'kyc',      label: t('pf_kyc'),          done: hasKyc, onPress: () => navigation.navigate('KycVerification') },
        { key: 'sub',      label: t('pf_subscription'), done: empIsSubscribed },
      ];
    }
    const fields: CompletenessField[] = [
      { key: 'name',     label: t('pf_name'),     done: !!user?.fullName?.trim() },
      { key: 'phone',    label: t('pf_phone'),    done: !!user?.phone },
      { key: 'state',    label: t('pf_state'),    done: !!user?.state?.trim() },
      { key: 'district', label: t('pf_district'), done: !!user?.district?.trim() },
      { key: 'photo',    label: t('pf_photo'),    done: !!user?.profileImage },
      { key: 'kyc',      label: t('pf_kyc'),      done: user?.kycStatus === 'verified', onPress: () => navigation.navigate('KycVerification') },
    ];
    // 10th/12th/ITI & Diploma/Graduate candidates must upload their education
    // document — surface it as a pending chip so the % reflects it (uploaded via
    // the document banner on Home).
    if (workerNeedsEducationDoc(user)) {
      fields.push({ key: 'eduDoc', label: t('pf_eduDoc'), done: hasEducationDoc(user) });
    }
    return fields;
  }, [isEmployer, t, navigation, user, user?.fullName, user?.phone, user?.email, user?.state, user?.district, user?.profileImage, user?.kycStatus, user?.resumeUrl, user?.workerSubType, empProfile?.kyc, empProfile?.status, empProfile?.profilePhoto, empIsSubscribed]);

  const handleSelectLanguage = async (lang: AppLanguage): Promise<void> => {
    setSavingLang(true);
    try {
      await setLanguage(lang);
      const label = LANGUAGE_OPTIONS.find((l) => l.value === lang)?.englishLabel ?? lang;
      toast.success(t('employer:pf_langChanged', { lang: label }));
    } catch {
      toast.error(t('employer:pf_langChangeFailed'));
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
    signOut();
  };

  const confirmDeleteAccount = async (): Promise<void> => {
    setIsDeletingAccount(true);
    try {
      await apiClient.delete('/api/v1/user/account');
      setDeleteAccountModalVisible(false);
      toast.success(t('employer:pf_accountDeleted'));
      setTimeout(() => { signOut(); }, 800);
    } catch {
      toast.error(t('employer:pf_accountDeleteFailed'));
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#1037A4' }}>
      <StatusBar barStyle="light-content" backgroundColor="#1037A4" />
      <VerifiedBadgeModal
        visible={verifiedModalVisible}
        onDismiss={() => setVerifiedModalVisible(false)}
        userRole={user?.role ?? ''}
        userId={user?.id ?? ''}
        userName={user?.fullName ?? ''}
        userEmail={user?.email ?? ''}
        userPhone={user?.phone ?? ''}
      />
      <ScrollView
        style={[styles.scroll, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
      {/* Avatar + name + role + location — unified hero (absorbs status bar) */}
      <View style={[styles.profileCenter, { backgroundColor: '#1037A4', paddingTop: insets.top + 16, paddingBottom: 24 }]}>
        {/* Depth layer — matches GradientHeader */}
        <View style={styles.heroDepth} pointerEvents="none" />
        <View style={[styles.heroCircle, styles.heroCircle1]} pointerEvents="none" />
        <View style={[styles.heroCircle, styles.heroCircle2]} pointerEvents="none" />
        <View style={[styles.heroCircle, styles.heroCircle3]} pointerEvents="none" />
        {/* Back arrow */}
        {navigation.canGoBack() && (
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.heroBack, { top: insets.top + 8 }]}
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <AppText style={styles.heroBackIcon}>‹</AppText>
          </TouchableOpacity>
        )}
        {/* Avatar with an edit-pencil badge — ring color reflects KYC state */}
        <View style={styles.avatarWrap}>
          <Avatar
            name={user?.fullName ?? 'U'}
            uri={user?.profileImage}
            size={80}
            ring
            ringColor={
              user?.kycStatus === 'verified'
                ? '#22C55E'
                : user?.kycStatus === 'rejected'
                ? '#EF4444'
                : '#F59E0B'
            }
          />
          <TouchableOpacity
            onPress={() => navigation.navigate('EditProfile')}
            style={styles.avatarEditBtn}
            activeOpacity={0.8}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name="pencil" size={12} color="#1037A4" />
          </TouchableOpacity>
        </View>
        <AppText style={styles.profileName}>{user?.fullName ?? t('employer:pf_userFallback')}</AppText>
        {(user?.district ?? user?.state) ? (
          <AppText style={styles.profileLocation}>
            <Ionicons name="location-sharp" size={12} color="rgba(255,255,255,0.85)" />{' '}
            {getLocationStr({ district: user?.district, state: user?.state }, i18n.language, '')}
          </AppText>
        ) : null}
        {/* Verification status pill */}
        {user?.kycStatus === 'verified' ? (
          <View style={styles.verifiedBadge}>
            <AppText style={styles.verifiedBadgeTxt}>{t('employer:pf_verifiedBadge')}</AppText>
          </View>
        ) : user?.kycStatus === 'rejected' ? (
          <TouchableOpacity
            onPress={() => navigation.navigate('KycVerification')}
            activeOpacity={0.85}
            style={styles.rejectedPill}
          >
            <Ionicons name="alert-circle" size={13} color="#fff" />
            <AppText style={styles.rejectedPillTxt}>{t('kyc_statusRejectedShort')}</AppText>
          </TouchableOpacity>
        ) : (
          <View style={styles.pendingPill}>
            <View style={styles.pendingPillDot} />
            <AppText style={styles.pendingPillTxt}>{t('profile_pendingVerification')}</AppText>
          </View>
        )}
        {user?.kycStatus === 'rejected' && !!user?.kycRejectionReason && (
          <AppText style={styles.rejectedReasonTxt} numberOfLines={3}>
            {user.kycRejectionReason}
          </AppText>
        )}
        {/* Edit Public Profile button */}
        <TouchableOpacity
          onPress={() => navigation.navigate('EditProfile')}
          style={styles.editProfileBtn}
          activeOpacity={0.8}
        >
          <Ionicons name="create-outline" size={15} color="#fff" style={styles.editProfileIcon} />
          <AppText style={styles.editProfileTxt}>{t('profile_editPublicProfile')}</AppText>
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        {/* Profile strength — sits directly under the profile photo hero.
            Tapping it opens Edit Profile to fill the remaining fields. */}
        {showCompleteness && (
          <ProfileCompletenessCard
            fields={completenessFields}
            onPress={() => navigation.navigate('EditProfile')}
            style={{ marginBottom: 0 }}
          />
        )}

        {/* Switch Account — only admin / superadmin have multiple roles */}
        {(user?.role === 'admin' || user?.role === 'superadmin') && (
          <TouchableOpacity
            onPress={() => navigation.navigate('SwitchAccount')}
            activeOpacity={0.8}
            style={[styles.switchCard, { backgroundColor: theme.colors.primary }, theme.shadow.md]}
          >
            <Ionicons name="swap-horizontal" size={22} color="#FFFFFF" style={styles.switchIcon} />
            <View style={styles.switchText}>
              <AppText variant="labelSm" color="#FFFFFF">{t('profile_switchAccount')}</AppText>
              <AppText variant="micro" color="rgba(255,255,255,0.75)">
                {availableRoles.length > 1
                  ? t('employer:pf_accountsActive', { n: availableRoles.length, role: currentBackendRole })
                  : t('profile_manageAccounts')}
              </AppText>
            </View>
            <AppText style={[styles.switchArrow, { color: 'rgba(255,255,255,0.7)' }]}>›</AppText>
          </TouchableOpacity>
        )}

        {/* Verification & Trust */}
        <MenuSection label={t('profile_sectionVerification')}>
          <MenuItem
            icon="shield-checkmark-outline"
            label={t('profile_kycVerification')}
            onPress={() => navigation.navigate('KycVerification')}
            badge={user?.kycStatus === 'pending' ? '1' : undefined}
            right={
              user?.kycStatus === 'verified' ? (
                <View style={styles.approvedBadge}>
                  <AppText style={styles.approvedBadgeTxt}>{t('profile_approved')}</AppText>
                </View>
              ) : undefined
            }
          />
          {/* Work Preferences — workers update skills, work areas, experience & resume anytime */}
          {(user?.role === 'worker' || user?.role === 'selfworker') && (
            <MenuItem
              icon="briefcase-outline"
              label={t('profile_workPreferences')}
              onPress={() => navigation.navigate('WorkPreferences')}
            />
          )}
          {/* Certificates — workers upload skill certs; agents upload labour licence */}
          {(user?.role === 'worker' || user?.role === 'selfworker' || user?.role === 'agent') && (
            <MenuItem
              icon={user?.role === 'agent' ? 'document-text-outline' : 'school-outline'}
              label={user?.role === 'agent' ? t('cert_licenceMenuLabel') : t('cert_menuLabel')}
              onPress={() => navigation.navigate('Certificates')}
            />
          )}
          {user?.role === 'agent' && (
            <MenuItem
              icon="ribbon-outline"
              label={t('becomeVerifiedAgent')}
              onPress={() => setVerifiedModalVisible(true)}
              isLast
              right={
                <View style={styles.verifyBadgeBtn}>
                  <AppText style={styles.verifyBadgeBtnText}>
                    {user?.role === 'agent'
                      ? `₹${pricing.verifiedBadge.agent}`
                      : `₹${pricing.verifiedBadge.worker}`}
                  </AppText>
                </View>
              }
            />
          )}
        </MenuSection>

        {/* ── Certificates / Labour Licence inline preview ─────────────── */}
        {showCerts && (
          <View style={[certStyles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            {/* Header row */}
            <View style={certStyles.headerRow}>
              <AppText style={[certStyles.title, { color: theme.colors.text }]} numberOfLines={1}>
                {user?.role === 'agent' ? t('cert_licencePageTitle') : t('cert_pageTitle')}
              </AppText>
              <TouchableOpacity onPress={() => navigation.navigate('Certificates')} activeOpacity={0.7}>
                <AppText style={[certStyles.manageBtn, { color: theme.colors.primary }]}>
                  {t('cert_view')} / {t('profile_editPublicProfile').split(' ')[0]} ›
                </AppText>
              </TouchableOpacity>
            </View>

            {/* ── Workers: horizontal scroll of cert thumbnails ── */}
            {(user?.role === 'worker' || user?.role === 'selfworker') && (
              <>
                {certificates.length === 0 ? (
                  <TouchableOpacity
                    onPress={() => navigation.navigate('Certificates')}
                    activeOpacity={0.8}
                    style={[certStyles.emptyRow, { borderColor: theme.colors.border }]}
                  >
                    <AppText style={certStyles.emptyIcon}>🎓</AppText>
                    <AppText style={[certStyles.emptyText, { color: theme.colors.mutedText }]}>
                      {t('cert_noCerts')}
                    </AppText>
                  </TouchableOpacity>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={certStyles.thumbRow}
                  >
                    {certificates.map((cert, i) => (
                      <TouchableOpacity
                        key={i}
                        onPress={() => void Linking.openURL(cert.url)}
                        activeOpacity={0.8}
                        style={[certStyles.thumbCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                      >
                        {cert.fileType === 'pdf' ? (
                          <View style={certStyles.pdfThumb}>
                            <AppText style={certStyles.pdfIcon}>📄</AppText>
                          </View>
                        ) : (
                          <Image source={{ uri: cert.url }} style={certStyles.thumbImg} resizeMode="cover" />
                        )}
                        <AppText style={[certStyles.thumbName, { color: theme.colors.mutedText }]} numberOfLines={2}>
                          {cert.name || t('cert_untitled')}
                        </AppText>
                      </TouchableOpacity>
                    ))}
                    {/* Add more tile */}
                    <TouchableOpacity
                      onPress={() => navigation.navigate('Certificates')}
                      activeOpacity={0.8}
                      style={[certStyles.addThumb, { borderColor: theme.colors.primary + '60', backgroundColor: theme.colors.primary + '08' }]}
                    >
                      <AppText style={[certStyles.addIcon, { color: theme.colors.primary }]}>＋</AppText>
                      <AppText style={[certStyles.addText, { color: theme.colors.primary }]}>{t('cert_upload').split(' ')[0]}</AppText>
                    </TouchableOpacity>
                  </ScrollView>
                )}
                {/* Count badge */}
                {certificates.length > 0 && (
                  <View style={certStyles.countRow}>
                    <View style={[certStyles.countPill, { backgroundColor: theme.colors.primary + '18' }]}>
                      <AppText style={[certStyles.countTxt, { color: theme.colors.primary }]}>
                        {certificates.length} {certificates.length === 1 ? t('cert_pageTitle').replace('My ', '') : t('cert_yourCerts')}
                      </AppText>
                    </View>
                  </View>
                )}
              </>
            )}

            {/* ── Agents: labour licence status ── */}
            {user?.role === 'agent' && (
              licenceUrl ? (
                <View style={certStyles.licenceRow}>
                  <TouchableOpacity
                    onPress={() => void Linking.openURL(licenceUrl)}
                    activeOpacity={0.8}
                    style={[certStyles.licencePreview, { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }]}
                  >
                    <AppText style={certStyles.licenceFileIcon}>📄</AppText>
                    <View style={{ flex: 1 }}>
                      <AppText style={[certStyles.licenceLabel, { color: '#16A34A' }]}>
                        ✓  {t('cert_licenceActive')}
                      </AppText>
                      <AppText style={[certStyles.licenceHint, { color: '#15803D' }]}>
                        {t('cert_view')} →
                      </AppText>
                    </View>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => navigation.navigate('Certificates')}
                  activeOpacity={0.8}
                  style={[certStyles.emptyRow, { borderColor: theme.colors.border }]}
                >
                  <AppText style={certStyles.emptyIcon}>📋</AppText>
                  <AppText style={[certStyles.emptyText, { color: theme.colors.mutedText }]}>
                    {t('cert_noLicence')}
                  </AppText>
                </TouchableOpacity>
              )
            )}
          </View>
        )}

        {/* Account Settings */}
        <MenuSection label={t('profile_sectionAccount')}>
          {/* Language picker — available to all roles (employer included). The
              choice persists to the DB via setLanguage and is rehydrated into the
              app-specific lang key on each boot by useLangSync. */}
          <MenuItem
            icon="language-outline"
            label={t('profile_language')}
            onPress={() => setLangModalVisible(true)}
            right={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, minWidth: 0 }}>
                <AppText variant="micro" color={theme.colors.primary} weight="700" style={{ flexShrink: 1 }}>
                  {currentLang?.nativeLabel ?? 'English'}
                </AppText>
                <AppText style={styles.menuChevron} color={theme.colors.mutedText}>›</AppText>
              </View>
            }
          />
          <MenuItem
            icon="notifications-outline"
            label={t('profile_notificationsHub')}
            onPress={() => navigation.navigate('Notifications')}
            right={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, minWidth: 0 }}>
                <AppText variant="micro" color={theme.colors.mutedText} style={{ flexShrink: 1 }}>{t('profile_allActivityAlerts')}</AppText>
                <AppText style={[styles.menuChevron, { color: theme.colors.mutedText }]}>›</AppText>
              </View>
            }
          />
          {(user?.role === 'agent' || user?.role === 'worker' || user?.role === 'selfworker') && (
            <MenuItem
              icon="mail-outline"
              label={t('profile_jobInvitations')}
              onPress={() => navigation.navigate('Invitations')}
            />
          )}
          <MenuItem icon="lock-closed-outline" label={t('profile_securityPrivacy')} onPress={() => navigation.navigate('TermsPrivacy')} />
          {user?.role === 'employer' && (
            <MenuItem icon="card-outline" label={t('profile_paymentsBilling')} onPress={() => navigation.navigate('Subscription')} />
          )}
          {user?.role === 'employer' && (
            <MenuItem icon="receipt-outline" label={t('profile_paymentHistory')} onPress={() => navigation.navigate('Transactions')} />
          )}
          {user?.role === 'employer' && (
            <MenuItem icon="pulse-outline" label={t('profile_myActivity')} onPress={() => navigation.navigate('MyActivity')} />
          )}
          {user?.role === 'employer' && (
            <MenuItem icon="call-outline" label={t('profile_callHistory')} onPress={() => navigation.navigate('CallHistory')} />
          )}
          {user?.role === 'employer' && (
            <MenuItem icon="eye-outline" label={t('profile_viewedContacts')} onPress={() => navigation.navigate('ViewedContacts')} />
          )}
          <MenuItem icon="options-outline" label={t('profile_notificationSettings')} onPress={() => navigation.navigate('NotificationPreferences')} isLast />
        </MenuSection>

        {/* Appearance Section */}
        <MenuSection label={t('profile_sectionAppearance')}>
          <MenuItem
            icon="moon-outline"
            label={t('profile_darkMode')}
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
          <MenuSection label={t('profile_sectionWorkers')}>
            <MenuItem
              icon="people-outline"
              label={t('profile_browseWorkers')}
              onPress={() => navigation.navigate('WorkerSearch')}
              isLast
            />
          </MenuSection>
        )}


      
        {/* Sign Out */}
        <TouchableOpacity
          onPress={handleSignOut}
          activeOpacity={0.82}
          style={[styles.signOutBtn, { backgroundColor: theme.colors.dangerLight, borderColor: theme.colors.danger }]}
        >
          <Ionicons name="log-out-outline" size={20} color={theme.colors.danger} style={styles.signOutIcon} />
          <AppText variant="label" color={theme.colors.danger} style={styles.signOutText}>
            {t('profile_signOut')}
          </AppText>
        </TouchableOpacity>
{/* Delete Account Accordion */}
<View
  style={[
    styles.deleteAccordionWrapper,
    {
      alignItems: 'center',
      marginTop: 30,
      marginBottom: 25,
    },
  ]}
>
  <View style={{ width: '90%', maxWidth: 360 }}>
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => setShowDeleteSection(!showDeleteSection)}
      style={[
        styles.deleteAccordionHeader,
        {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingVertical: 8,
          paddingHorizontal: 6,
        },
      ]}
    >
      <AppText
        style={[
          styles.deleteAccordionTitle,
          {
            fontSize: 12,
            color: '#999',
            opacity: 0.8,
            textAlign: 'center',
            flex: 1,
          },
        ]}
      >
        {t('profile_deleteAccountHint')}
      </AppText>

      <AppText
        style={[
          styles.deleteAccordionArrow,
          {
            fontSize: 14,
            color: '#999',
            marginLeft: 8,
          },
        ]}
      >
        {showDeleteSection ? '⌃' : '⌄'}
      </AppText>
    </TouchableOpacity>

    {showDeleteSection && (
      <View
        style={[
          styles.dangerZoneCard,
          {
            marginTop: 8,
            borderWidth: 1,
            borderRadius: 14,
            padding: 10,
            borderColor: theme.colors.danger + '30',
            backgroundColor: theme.colors.dangerLight,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => setDeleteAccountModalVisible(true)}
          activeOpacity={0.75}
          style={[
            styles.deleteAccountRow,
            {
              flexDirection: 'row',
              alignItems: 'center',
            },
          ]}
        >
          <View
            style={[
              styles.menuIconWrap,
              {
                width: 34,
                height: 34,
                borderRadius: 10,
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: 10,
                backgroundColor: theme.colors.danger + '15',
              },
            ]}
          >
            <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
          </View>

          <View style={{ flex: 1 }}>
            <AppText
              variant="body"
              color={theme.colors.danger}
              style={{
                fontWeight: '700',
                fontSize: 13,
              }}
            >
              {t('profile_deleteAccount')}
            </AppText>

            <AppText
              variant="micro"
              color={theme.colors.danger}
              style={{
                opacity: 0.7,
                marginTop: 2,
                fontSize: 10,
              }}
            >
              {t('profile_deleteAccountDesc')}
            </AppText>
          </View>
        </TouchableOpacity>
      </View>
    )}
  </View>
</View>
        <AppText variant="micro" color={theme.colors.mutedText} style={styles.version}>
          {t('profile_version')}
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
              {t('profile_chooseLanguage')}
            </AppText>
            <AppText variant="caption" color={theme.colors.mutedText} style={styles.modalSub}>
              {t('selectLanguage')}
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
            <Ionicons name="log-out-outline" size={34} color={theme.colors.danger} style={styles.signOutEmoji} />
            <AppText variant="subtitle" style={styles.signOutTitle}>{t('profile_signOutTitle')}</AppText>
            <AppText variant="body" color={theme.colors.mutedText} style={styles.signOutMessage}>
              {t('profile_signOutMessage')}
            </AppText>
            <View style={styles.signOutActions}>
              <TouchableOpacity
                onPress={() => setSignOutModalVisible(false)}
                style={[styles.signOutActionBtn, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                activeOpacity={0.8}
              >
                <AppText variant="label" color={theme.colors.text}>{t('cancel')}</AppText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmSignOut}
                style={[styles.signOutActionBtn, { backgroundColor: theme.colors.danger }]}
                activeOpacity={0.8}
              >
                <AppText variant="label" color="#FFFFFF">{t('profile_signOut')}</AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* Delete Account Confirmation Modal */}
      <Modal
        visible={deleteAccountModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => { if (!isDeletingAccount) setDeleteAccountModalVisible(false); }}
      >
        <View style={styles.signOutOverlay}>
          <View style={[styles.signOutDialog, { backgroundColor: theme.colors.card }]}>
            <Ionicons name="warning-outline" size={34} color={theme.colors.danger} style={styles.signOutEmoji} />
            <AppText variant="subtitle" color={theme.colors.danger} style={styles.signOutTitle}>
              {t('profile_deleteAccountTitle')}
            </AppText>
            <AppText variant="body" color={theme.colors.mutedText} style={styles.signOutMessage}>
              {t('profile_deleteAccountMessage')}
            </AppText>
            <View style={styles.signOutActions}>
              <TouchableOpacity
                onPress={() => setDeleteAccountModalVisible(false)}
                disabled={isDeletingAccount}
                style={[styles.signOutActionBtn, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, opacity: isDeletingAccount ? 0.5 : 1 }]}
                activeOpacity={0.8}
              >
                <AppText variant="label" color={theme.colors.text}>{t('cancel')}</AppText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => void confirmDeleteAccount()}
                disabled={isDeletingAccount}
                style={[styles.signOutActionBtn, { backgroundColor: theme.colors.danger, opacity: isDeletingAccount ? 0.7 : 1 }]}
                activeOpacity={0.8}
              >
                {isDeletingAccount ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <AppText variant="label" color="#FFFFFF">{t('profile_deleteBtn')}</AppText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: 48 },

  // ── Profile hero — continuous from status bar, matches GradientHeader look ──
  profileCenter: {
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  heroDepth: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1037A4',
    opacity: 0.45,
  },
  heroCircle: { position: 'absolute', borderRadius: 999 },
  heroCircle1: { width: 260, height: 260, top: -110, right: -70, backgroundColor: 'rgba(255,255,255,0.055)' },
  heroCircle2: { width: 160, height: 160, bottom: -60, left: '30%', backgroundColor: 'rgba(255,255,255,0.04)' },
  heroCircle3: { width: 120, height: 120, top: 20, left: -40, backgroundColor: 'rgba(255,255,255,0.03)' },
  verifiedBadge: {
    backgroundColor: '#16a34a',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 2,
  },
  verifiedBadgeTxt: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  // Avatar with edit-pencil badge
  avatarWrap: { position: 'relative' },
  avatarEditBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#1037A4',
  },
  avatarEditIcon: { fontSize: 12, lineHeight: 16 },
  // Pending verification pill
  pendingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(245,158,11,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.55)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 2,
  },
  pendingPillDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#F59E0B' },
  pendingPillTxt: { fontSize: 10.5, fontWeight: '800', color: '#FBBF24', letterSpacing: 0.6 },
  rejectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239,68,68,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.7)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 2,
  },
  rejectedPillTxt: { fontSize: 10.5, fontWeight: '800', color: '#FECACA', letterSpacing: 0.6 },
  rejectedReasonTxt: {
    fontSize: 11.5,
    lineHeight: 16,
    color: 'rgba(255,255,255,0.92)',
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 280,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.2,
    marginTop: 2,
  },
  profileRole: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '500',
    textAlign: 'center',
  },
  profileLocation: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  editProfileBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 28,
  },
  editProfileIcon: { fontSize: 13, lineHeight: 17 },
  editProfileTxt: { fontSize: 13, fontWeight: '700', color: '#fff' },
  heroBack: {
    position: 'absolute',
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  heroBackIcon: { fontSize: 26, color: '#fff', fontWeight: '300', lineHeight: 30, marginLeft: -2 },

  approvedBadge: { backgroundColor: '#dcfce7', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#86efac' },
  approvedBadgeTxt: { fontSize: 11, fontWeight: '700', color: '#16a34a' },
  verifyBadgeBtn: { backgroundColor: '#F0FDF4', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#86EFAC' },
  verifyBadgeBtnText: { fontSize: 12, fontWeight: '800', color: '#15803D' },

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
    borderRadius: 20,
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
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIcon: { fontSize: 19, lineHeight: 23 },
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
    borderRadius: 15,
    borderWidth: 1.6,
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

  dangerZoneCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    overflow: 'hidden',
    paddingBottom: 4,
  },
  dangerZoneLabel: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    letterSpacing: 1,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  deleteAccountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingBottom: 44,
    paddingTop: 12,
    maxHeight: '88%',
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

// ── Certificate inline card styles ─────────────────────────────────────────────
const certStyles = StyleSheet.create({
  card: {
    borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 12,
    shadowColor: '#1037A4', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  headerRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 14 },
  title:      { fontSize: 14, fontWeight: '800', flexShrink: 1, minWidth: 0 },
  manageBtn:  { fontSize: 12, fontWeight: '700', flexShrink: 0 },

  // empty state
  emptyRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', padding: 14 },
  emptyIcon:  { fontSize: 22, lineHeight: 28, flexShrink: 0 },
  emptyText:  { flex: 1, fontSize: 12, lineHeight: 17 },

  // horizontal scroll of cert thumbnails
  thumbRow:   { gap: 10, paddingBottom: 2 },
  thumbCard: {
    width: 90, borderRadius: 14, borderWidth: 1, overflow: 'hidden',
    alignItems: 'center', padding: 8, gap: 6,
  },
  thumbImg:   { width: 74, height: 60, borderRadius: 8 },
  pdfThumb:   { width: 74, height: 60, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF3C7' },
  pdfIcon:    { fontSize: 28, lineHeight: 36 },
  thumbName:  { fontSize: 10, textAlign: 'center', lineHeight: 14, width: 74 },

  // add tile
  addThumb:   { width: 74, height: 74, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4, alignSelf: 'flex-start' },
  addIcon:    { fontSize: 22, fontWeight: '300', lineHeight: 28 },
  addText:    { fontSize: 10, fontWeight: '700' },

  // count badge
  countRow:   { marginTop: 10 },
  countPill:  { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  countTxt:   { fontSize: 11, fontWeight: '700' },

  // agent licence
  licenceRow:     { gap: 10 },
  licencePreview: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, borderWidth: 1, padding: 12 },
  licenceFileIcon:{ fontSize: 28, lineHeight: 36, flexShrink: 0 },
  licenceLabel:   { fontSize: 13, fontWeight: '700', lineHeight: 18 },
  licenceHint:    { fontSize: 11, fontWeight: '600', marginTop: 2 },
});
