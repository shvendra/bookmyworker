import React from 'react';
import { FlatList, RefreshControl, StatusBar, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppCard } from '../../../shared/components/ui/AppCard';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { Badge, type BadgeVariant } from '../../../shared/components/ui/Badge';
import { EmptyState } from '../../../shared/components/feedback/EmptyState';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { LoadingState } from '../../../shared/components/feedback/LoadingState';
import { useAppTheme } from '../../../core/theme';
import { clientCompaniesApi } from '../../../core/api/endpoints/clientCompaniesApi';
import {
  workforceRequirementsApi,
  type PrivateWorkforceRequirement,
  type RequirementStatus,
} from '../../../core/api/endpoints/workforceRequirementsApi';
import type { MainStackParamList } from '../../../app/navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'MyWorkforceRequirements'>;

const BRAND = '#1037A4';

const STATUS_BADGE_VARIANT: Record<RequirementStatus, BadgeVariant> = {
  Submitted: 'secondary',
  UnderReview: 'warning',
  Approved: 'success',
  Rejected: 'danger',
  PartiallyFulfilled: 'info',
  Fulfilled: 'success',
  Closed: 'neutral',
  Cancelled: 'neutral',
};

const STATUS_LABEL_KEY: Record<RequirementStatus, string> = {
  Submitted: 'wf_status_submitted',
  UnderReview: 'wf_status_underreview',
  Approved: 'wf_status_approved',
  Rejected: 'wf_status_rejected',
  PartiallyFulfilled: 'wf_status_partiallyfulfilled',
  Fulfilled: 'wf_status_fulfilled',
  Closed: 'wf_status_closed',
  Cancelled: 'wf_status_cancelled',
};

const populatedName = (ref: unknown): string | undefined => {
  if (ref && typeof ref === 'object' && 'name' in ref) {
    const n = (ref as { name?: unknown }).name;
    return typeof n === 'string' ? n : undefined;
  }
  return undefined;
};

const formatDate = (d?: string): string => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
};

interface RowProps {
  item: PrivateWorkforceRequirement;
  onPress: () => void;
}

const RequirementRow = React.memo(({ item, onPress }: RowProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
  const workTypeName = populatedName(item.workTypeId) ?? '—';
  const statusVariant = STATUS_BADGE_VARIANT[item.status] ?? 'neutral';
  const statusLabel = t(STATUS_LABEL_KEY[item.status] ?? 'wf_status_submitted');

  return (
    <AppCard onPress={onPress} style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <AppText variant="label" style={styles.pwr} numberOfLines={1}>
          {item.pwrNumber}
        </AppText>
        <Badge label={statusLabel} variant={statusVariant} size="sm" />
      </View>
      <AppText variant="body" color={theme.colors.textSecondary} numberOfLines={1} style={styles.metaRow}>
        {workTypeName} · {t('wf_workers_count', { count: item.numberOfWorkers })}
      </AppText>
      <View style={styles.cardFooterRow}>
        {item.urgency === 'Urgent' ? (
          <Badge label={t('wf_urgency_urgent')} variant="danger" size="sm" outlined />
        ) : null}
        <AppText variant="caption" color={theme.colors.mutedText}>
          {t('wf_submitted_on', { date: formatDate(item.createdAt) })}
        </AppText>
      </View>
    </AppCard>
  );
});
RequirementRow.displayName = 'RequirementRow';

export const MyWorkforceRequirementsScreen = ({ navigation }: Props): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');

  const companyQuery = useQuery({
    queryKey: ['wf-my-company'],
    queryFn: () => clientCompaniesApi.getMyCompany(),
    staleTime: 60_000,
  });

  const hasCompany = !!companyQuery.data;

  const requirementsQuery = useQuery({
    queryKey: ['wf-requirements-mine'],
    queryFn: () => workforceRequirementsApi.listMine(),
    enabled: hasCompany,
    staleTime: 30_000,
  });

  const requirements = requirementsQuery.data ?? [];

  const goToNew = (): void => navigation.navigate('NewWorkforceRequirement');
  const goToDetail = (id: string): void => navigation.navigate('WorkforceRequirementDetail', { id });

  if (companyQuery.isLoading) {
    return <LoadingState message={t('wf_requirements_title')} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND} />
      <ScreenHeader
        title={t('wf_requirements_title')}
        onBack={() => navigation.goBack()}
        rightIcon={hasCompany ? '➕' : undefined}
        onRightPress={hasCompany ? goToNew : undefined}
      />

      {companyQuery.isError ? (
        <ErrorState onRetry={() => void companyQuery.refetch()} />
      ) : !hasCompany ? (
        <EmptyState
          icon="🏢"
          title={t('wf_not_setup_title')}
          description={t('wf_not_setup_body')}
        />
      ) : requirementsQuery.isLoading ? (
        <LoadingState message={t('wf_requirements_title')} />
      ) : requirementsQuery.isError ? (
        <ErrorState
          title={t('wf_load_requirements_failed')}
          description={t('wf_load_requirements_failed_body')}
          onRetry={() => void requirementsQuery.refetch()}
        />
      ) : requirements.length === 0 ? (
        <EmptyState
          icon="📋"
          title={t('wf_requirements_empty')}
          description={t('wf_requirements_empty_body')}
          action={<AppButton title={t('wf_new_requirement_cta')} onPress={goToNew} />}
        />
      ) : (
        <FlatList
          data={requirements}
          keyExtractor={(item: PrivateWorkforceRequirement) => item._id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={requirementsQuery.isFetching} onRefresh={() => void requirementsQuery.refetch()} />
          }
          renderItem={({ item }: { item: PrivateWorkforceRequirement }) => (
            <RequirementRow item={item} onPress={() => goToDetail(item._id)} />
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, paddingBottom: 40 },
  card: { marginBottom: 12 },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  pwr: { flex: 1 },
  metaRow: { marginBottom: 8 },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
});
