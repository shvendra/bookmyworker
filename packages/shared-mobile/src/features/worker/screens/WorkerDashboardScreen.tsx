import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
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
const greet = (): string => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

export const WorkerDashboardScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { state } = useAuth();
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

  return (
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
      {/* Premium Gradient Header */}
      <GradientHeader
        subtitle={greet()}
        title={user?.fullName ?? 'Worker'}
        caption="Find opportunities near you"
        avatarName={user?.fullName ?? 'W'}
        onAvatarPress={() => navigation.navigate('Profile' as never)}
        rightIcon="🔔"
        onRightPress={() => {}}
      >
        {/* Wallet strip inside header */}
        <View style={styles.walletStrip}>
          <View style={styles.walletLeft}>
            <AppText variant="micro" color="rgba(255,255,255,0.65)">Wallet Balance</AppText>
            <AppText variant="numeric" color="#FFFFFF" style={styles.walletAmt}>
              ₹{balance.toLocaleString('en-IN')}
            </AppText>
          </View>
          <AppButton
            title="Withdraw"
            variant="outline"
            size="sm"
            onPress={() => navigation.navigate('Wallet' as never)}
            style={styles.withdrawBtn}
          />
        </View>
      </GradientHeader>

      <View style={styles.body}>
        {/* KYC Alert */}
        {kycPending && (
          <View style={[styles.alertBanner, { backgroundColor: theme.colors.warningLight, borderColor: theme.colors.warning }]}>
            <AppText style={styles.alertIcon}>⚠️</AppText>
            <View style={styles.alertTextWrap}>
              <AppText variant="labelSm" color={theme.colors.warning}>KYC Verification Pending</AppText>
              <AppText variant="caption" color={theme.colors.mutedText} style={styles.alertSub}>
                Complete your KYC to receive job invitations and payouts
              </AppText>
            </View>
          </View>
        )}

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

        {/* Browse by Category */}
        <SectionHeader
          title="Browse by Category"
          actionLabel="See all"
          onAction={() => navigation.navigate('JobMarketplace')}
          style={styles.sectionGap}
        />
        <WorkerCategoryGrid onCategoryPress={handleCategoryPress} />


        {/* Explore CTA */}
        <View
          style={[
            styles.exploreCta,
            { backgroundColor: theme.colors.primaryLight },
          ]}
        >
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
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: 40 },

  walletStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  walletLeft: { gap: 2 },
  walletAmt: { fontSize: 20, lineHeight: 26 },
  withdrawBtn: { borderColor: 'rgba(255,255,255,0.5)' },

  body: { padding: 16, gap: 0 },

  alertBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    marginBottom: 20,
  },
  alertIcon: { fontSize: 18, lineHeight: 22 },
  alertTextWrap: { flex: 1, gap: 3 },
  alertSub: { lineHeight: 16 },

  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 16,
    padding: 14,
    gap: 4,
    borderWidth: 1,
  },
  statIcon: { fontSize: 22, lineHeight: 26 },
  statValue: { fontSize: 22, lineHeight: 28 },

  sectionGap: { marginTop: 20 },

  appCard: {
    flexDirection: 'row',
    borderRadius: 14,
    marginBottom: 8,
    overflow: 'hidden',
    borderWidth: 1,
  },
  appStatusBar: {
    width: 4,
  },
  appCardBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 10,
  },
  appInfo: { flex: 1, gap: 4 },
  appDate: { lineHeight: 15 },

  exploreCta: {
    borderRadius: 18,
    padding: 20,
    marginTop: 24,
    gap: 8,
  },
  exploreTitle: { fontSize: 18, lineHeight: 24 },
  exploreSub: { lineHeight: 18, marginBottom: 4 },
});
