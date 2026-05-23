import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Alert, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requirementsApi } from '../../../core/api/endpoints/requirementsApi';
import { useAuth } from '../../../state/auth/AuthContext';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { AppCard } from '../../../shared/components/ui/AppCard';
import { Badge, statusToBadgeVariant } from '../../../shared/components/ui/Badge';
import { LoadingState } from '../../../shared/components/feedback/LoadingState';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { useAppTheme } from '../../../core/theme';
import type { MainStackParamList } from '../../../app/navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'JobDetail'>;

export const JobDetailScreen = ({ route, navigation }: Props): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { state } = useAuth();
  const queryClient = useQueryClient();
  const { jobId } = route.params;
  const [applied, setApplied] = useState(false);

  const { data: job, isLoading, isError, refetch } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => requirementsApi.getJobById(jobId),
  });

  const applyMutation = useMutation({
    mutationFn: () => requirementsApi.submitApplication({ jobId }),
    onSuccess: () => {
      setApplied(true);
      void queryClient.invalidateQueries({ queryKey: ['my-applications'] });
      Alert.alert('Applied!', 'Your application has been submitted successfully.');
    },
    onError: (err) => {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not submit application');
    },
  });

  const userRole = state.session?.user.role;
  const canApply = userRole === 'worker' || userRole === 'agent';

  if (isLoading) return <LoadingState message="Loading job details…" />;
  if (isError || !job) {
    return <ErrorState title="Job not found" description="This job may have been removed." onRetry={refetch} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="#1037A4" />
      <ScreenHeader title={job.title ?? 'Job Detail'} onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Job Title & Status */}
        <AppCard style={styles.titleCard}>
          <View style={styles.titleRow}>
            <AppText variant="title" style={styles.jobTitle}>{job.title}</AppText>
            <Badge label={job.status} variant={statusToBadgeVariant(job.status)} />
          </View>
          <AppText variant="body" color={theme.colors.mutedText}>
            {job.category}{job.subCategory ? ` › ${job.subCategory}` : ''}
          </AppText>
          {job.postedByName && (
            <AppText variant="caption" color={theme.colors.mutedText} style={styles.postedBy}>
              Posted by {job.postedByName}
            </AppText>
          )}
        </AppCard>

        {/* Key Details */}
        <AppCard style={styles.detailsCard}>
          <AppText variant="label" style={styles.sectionLabel}>Job Details</AppText>
          <View style={styles.detailGrid}>
            <DetailRow icon="📍" label="Location" value={`${job.district}, ${job.state}`} theme={theme} />
            <DetailRow icon="👷" label="Workers Needed" value={`${job.workerCount} worker${job.workerCount !== 1 ? 's' : ''}`} theme={theme} />
            {job.dailyRate ? (
              <DetailRow icon="💰" label="Daily Rate" value={`₹${job.dailyRate}/day`} theme={theme} />
            ) : null}
            {job.duration ? (
              <DetailRow icon="⏱️" label="Duration" value={job.duration} theme={theme} />
            ) : null}
            {job.tehsil ? (
              <DetailRow icon="🏘️" label="Tehsil" value={job.tehsil} theme={theme} />
            ) : null}
            <DetailRow
              icon="📅"
              label="Posted On"
              value={new Date(job.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              theme={theme}
            />
          </View>
        </AppCard>

        {/* Description */}
        {job.description ? (
          <AppCard style={styles.descCard}>
            <AppText variant="label" style={styles.sectionLabel}>Description</AppText>
            <AppText variant="body" color={theme.colors.text} style={styles.description}>
              {job.description}
            </AppText>
          </AppCard>
        ) : null}
      </ScrollView>

      {/* Apply CTA */}
      {canApply && (
        <View style={[styles.footer, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
          {applied ? (
            <View style={[styles.appliedBadge, { backgroundColor: theme.colors.success + '20', borderColor: theme.colors.success }]}>
              <AppText variant="label" color={theme.colors.success}>✓ Application Submitted</AppText>
            </View>
          ) : (
            <AppButton
              title={job.status === 'open' ? 'Apply Now' : 'Job Closed'}
              onPress={() => applyMutation.mutate()}
              loading={applyMutation.isPending}
              disabled={job.status !== 'open' || applyMutation.isPending}
            />
          )}
        </View>
      )}
    </View>
  );
};

interface DetailRowProps {
  icon: string;
  label: string;
  value: string;
  theme: { colors: { mutedText: string; text: string } };
}

const DetailRow = ({ icon, label, value, theme }: DetailRowProps): React.JSX.Element => (
  <View style={detailRowStyles.row}>
    <AppText variant="body" style={detailRowStyles.icon}>{icon}</AppText>
    <View style={detailRowStyles.content}>
      <AppText variant="caption" color={theme.colors.mutedText}>{label}</AppText>
      <AppText variant="body" color={theme.colors.text}>{value}</AppText>
    </View>
  </View>
);

const detailRowStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  icon: { fontSize: 18, width: 28, marginTop: 2 },
  content: { flex: 1, gap: 1 },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 100 },
  titleCard: { marginBottom: 12 },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  jobTitle: { flex: 1 },
  postedBy: { marginTop: 8 },
  detailsCard: { marginBottom: 12 },
  descCard: { marginBottom: 12 },
  sectionLabel: { marginBottom: 14 },
  detailGrid: { gap: 0 },
  description: { lineHeight: 22 },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  appliedBadge: {
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
});
