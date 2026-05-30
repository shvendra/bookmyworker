import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { FlatList, StatusBar, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { useQuery } from '@tanstack/react-query';
import { requirementsApi } from '../../../core/api/endpoints/requirementsApi';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppCard } from '../../../shared/components/ui/AppCard';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { Badge } from '../../../shared/components/ui/Badge';
import { EmptyState } from '../../../shared/components/feedback/EmptyState';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { LoadingState } from '../../../shared/components/feedback/LoadingState';
import { useAppTheme } from '../../../core/theme';
import type { MainStackParamList } from '../../../app/navigation/types';
import type { Application } from '../../../shared/types/domain';

type Props = NativeStackScreenProps<MainStackParamList, 'MyApplications'>;

const applicationStatusVariant = (status: Application['status']) => {
  switch (status) {
    case 'Accepted': return 'success' as const;
    case 'Rejected':
    case 'Closed': return 'danger' as const;
    case 'Invited': return 'primary' as const;
    default: return 'warning' as const;
  }
};

export const MyApplicationsScreen = ({ navigation }: Props): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['my-applications'],
    queryFn: () => requirementsApi.getMyApplications(),
    staleTime: 30_000,
  });

  const applications: Application[] = data?.applications ?? [];

  if (isLoading) return <LoadingState message={t('loadingApplications')} />;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="#1037A4" />
      <ScreenHeader title={t('myApplicationsTab')} onBack={() => navigation.goBack()} />

      {isError ? (
        <ErrorState
          title={t('couldNotLoadApps')}
          description={t('checkConnectionRetry')}
          onRetry={refetch}
        />
      ) : applications.length === 0 ? (
        <EmptyState
          icon="📋"
          title={t('noApplicationsTitle')}
          description={t('noApplicationsDesc')}
          action={
            <AppButton
              title={t('browseJobs')}
              onPress={() => navigation.navigate('JobMarketplace')}
            />
          }
        />
      ) : (
        <FlatList
          data={applications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <AppText variant="caption" color={theme.colors.mutedText} style={styles.count}>
              {t('applicationsCount', { count: applications.length })}
            </AppText>
          }
          renderItem={({ item }) => (
            <AppCard style={styles.card}>
              <View style={styles.cardHeader}>
                <AppText variant="label" style={styles.jobTitle} numberOfLines={2}>
                  {item.requirementTitle}
                </AppText>
                <Badge
                  label={item.status}
                  variant={applicationStatusVariant(item.status)}
                />
              </View>

              {item.notes ? (
                <AppText variant="caption" color={theme.colors.mutedText} style={styles.notes} numberOfLines={2}>
                  {item.notes}
                </AppText>
              ) : null}

              <View style={styles.cardMeta}>
                <AppText variant="caption" color={theme.colors.mutedText}>
                  {t('appliedLabel')} {new Date(item.appliedAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </AppText>
                {item.updatedAt && item.updatedAt !== item.appliedAt ? (
                  <AppText variant="caption" color={theme.colors.mutedText}>
                    {t('updatedLabel')} {new Date(item.updatedAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </AppText>
                ) : null}
              </View>

              {item.status === 'Invited' && (
                <View style={[styles.inviteNote, { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary + '40' }]}>
                  <AppText variant="caption" color={theme.colors.primary}>
                    {t('invitedToJobMsg')}
                  </AppText>
                </View>
              )}
            </AppCard>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, paddingBottom: 40 },
  count: { marginBottom: 12 },
  card: { marginBottom: 12 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  jobTitle: { flex: 1 },
  notes: { marginBottom: 8 },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  inviteNote: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
});
