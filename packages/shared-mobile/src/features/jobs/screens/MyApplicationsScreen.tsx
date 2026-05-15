import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
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

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['my-applications'],
    queryFn: () => requirementsApi.getMyApplications(),
    staleTime: 30_000,
  });

  const applications: Application[] = data?.applications ?? [];

  if (isLoading) return <LoadingState message="Loading your applications…" />;
  if (isError) {
    return (
      <ErrorState
        title="Could not load applications"
        description="Check your connection and try again."
        onRetry={refetch}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <AppButton
          title="← Back"
          variant="ghost"
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        />
        <AppText variant="subtitle" style={styles.headerTitle}>My Applications</AppText>
        <View style={styles.headerRight} />
      </View>

      {applications.length === 0 ? (
        <EmptyState
          icon="📋"
          title="No applications yet"
          description="Browse the job marketplace and apply to jobs that match your skills."
          action={
            <AppButton
              title="Browse Jobs"
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
              {applications.length} application{applications.length !== 1 ? 's' : ''}
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
                  📅 Applied {new Date(item.appliedAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </AppText>
                {item.updatedAt && item.updatedAt !== item.appliedAt ? (
                  <AppText variant="caption" color={theme.colors.mutedText}>
                    Updated {new Date(item.updatedAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </AppText>
                ) : null}
              </View>

              {item.status === 'Invited' && (
                <View style={[styles.inviteNote, { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary + '40' }]}>
                  <AppText variant="caption" color={theme.colors.primary}>
                    🎉 You have been invited for this job! Contact the employer to confirm.
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 60 },
  headerTitle: { flex: 1, textAlign: 'center' },
  headerRight: { width: 60 },
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
