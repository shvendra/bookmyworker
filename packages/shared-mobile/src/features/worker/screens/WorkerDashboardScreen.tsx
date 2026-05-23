import React from 'react';
import { Pressable, RefreshControl, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../../core/theme';
import { walletApi } from '../../../core/api/endpoints/walletApi';
import { useAuth } from '../../../state/auth/AuthContext';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { SectionHeader } from '../../../shared/components/ui/SectionHeader';
import { GradientHeader } from '../../../shared/components/ui/GradientHeader';
import { QuickActionCard, QuickActionsRow } from '../../../shared/components/ui/QuickActionCard';
import { WorkerCategoryGrid } from '../../../shared/components/ui/WorkerCategoryGrid';
import type { WorkCategory } from '../../../shared/components/ui/WorkerCategoryGrid';
import type { MainStackParamList } from '../../../app/navigation/types';

const getGreetKey = (): 'goodMorning' | 'goodAfternoon' | 'goodEvening' => {
  const h = new Date().getHours();
  if (h < 12) return 'goodMorning';
  if (h < 17) return 'goodAfternoon';
  return 'goodEvening';
};

export const WorkerDashboardScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { state } = useAuth();
  const { t } = useTranslation();
  const user = state.session?.user;
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();

  const balanceQuery = useQuery({
    queryKey: ['wallet-balance', user?.id ?? ''],
    queryFn: walletApi.getMyWalletBalance,
    staleTime: 3 * 60 * 1000,
    enabled: !!user?.id,
  });

  const isRefreshing = balanceQuery.isFetching;

  const handleRefresh = (): void => {
    void balanceQuery.refetch();
  };

  const handleCategoryPress = (cat: WorkCategory): void => {
    navigation.navigate('JobMarketplace', { workType: cat.label });
  };

  const balance = balanceQuery.data ?? 0;
  const kycPending = user?.kycStatus === 'pending';
  const greetKey = getGreetKey();

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor="#1037A4" />

      {/* ── Hero Header ──────────────────────────────────────────────── */}
      <GradientHeader
        subtitle={t(greetKey)}
        title={user?.fullName ?? 'Worker'}
        caption={
          kycPending
            ? `⚠️ ${t('verificationPending')}`
            : `✓ Verified`
        }
        avatarName={user?.fullName ?? 'W'}
        onAvatarPress={() => navigation.navigate('Profile')}
        rightIcon="🔔"
        onRightPress={() => navigation.navigate('Notifications')}
      >
        {/* Wallet balance baked into hero */}
        <View style={styles.heroWallet}>
          <View style={styles.heroWalletLeft}>
            <AppText style={styles.heroWalletLabel}>{t('walletBalance')}</AppText>
            <AppText style={styles.heroWalletAmt}>
              ₹{balance.toLocaleString('en-IN')}
            </AppText>
          </View>
          <AppButton
            title={t('withdraw')}
            variant="outline"
            size="sm"
            onPress={() => navigation.navigate('Wallet' as never)}
            style={styles.withdrawBtn}
          />
        </View>
      </GradientHeader>

      <ScrollView
        style={[styles.scroll, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.body}>

          {/* KYC Alert */}
          {kycPending && (
            <Pressable
              onPress={() => navigation.navigate('Kyc')}
              style={[styles.alertBanner, { backgroundColor: theme.colors.warningLight, borderColor: theme.colors.warning }]}
            >
              <AppText style={styles.alertIcon}>⚠️</AppText>
              <View style={styles.alertTextWrap}>
                <AppText variant="labelSm" color={theme.colors.warning}>{t('kycPendingTitle')}</AppText>
                <AppText variant="caption" color={theme.colors.mutedText} style={styles.alertSub}>
                  {t('kycPendingMsg')}
                </AppText>
              </View>
            </Pressable>
          )}

          {/* ── Browse Work Categories ─────────────────────────────── */}
          <SectionHeader
            title={t('browseCategories')}
            subtitle={t('browseCategoriesSubtitle')}
            actionLabel={t('seeAll')}
            onAction={() => navigation.navigate('JobMarketplace')}
            style={styles.sectionFirst}
          />
          <WorkerCategoryGrid
            onCategoryPress={handleCategoryPress}
            columns={3}
            cellHeight={100}
          />

          {/* Quick Actions */}
          <SectionHeader title="Quick Actions" style={styles.sectionGap} />
          <QuickActionsRow>
            <QuickActionCard
              icon="🔍"
              title="Browse Jobs"
              subtitle="Find near you"
              color={theme.colors.primary}
              onPress={() => navigation.navigate('JobMarketplace')}
            />
            <QuickActionCard
              icon="📅"
              title="Attendance"
              subtitle="Mark today"
              color={theme.colors.success}
              onPress={() => navigation.navigate('Attendance' as never)}
            />
          </QuickActionsRow>

          {/* Explore CTA */}
          <View style={[styles.exploreCta, { backgroundColor: theme.colors.primaryLight }]}>
            <AppText variant="heading" color={theme.colors.primary} style={styles.exploreTitle}>
              Find Work Near You
            </AppText>
            <AppText variant="caption" color={theme.colors.mutedText} style={styles.exploreSub}>
              Browse hundreds of open requirements and apply instantly.
            </AppText>
            <AppButton
              title="Browse All Jobs →"
              onPress={() => navigation.navigate('JobMarketplace')}
              size="md"
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: 40 },

  // ── Hero wallet (inside GradientHeader children) ─────────────────────────
  heroWallet: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  heroWalletLeft: { gap: 3 },
  heroWalletLabel: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 11,
    fontWeight: '600',
  },
  heroWalletAmt: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 26,
  },
  withdrawBtn: { borderColor: 'rgba(255,255,255,0.5)' },

  body: { padding: 16, gap: 0 },

  alertBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  alertIcon: { fontSize: 18, lineHeight: 22 },
  alertTextWrap: { flex: 1, gap: 3 },
  alertSub: { lineHeight: 16 },

  sectionFirst: { marginTop: 4, marginBottom: 10 },
  sectionGap: { marginTop: 20 },

  exploreCta: {
    borderRadius: 18,
    padding: 20,
    marginTop: 24,
    gap: 8,
  },
  exploreTitle: { fontSize: 18, lineHeight: 24 },
  exploreSub: { lineHeight: 18, marginBottom: 4 },
});
