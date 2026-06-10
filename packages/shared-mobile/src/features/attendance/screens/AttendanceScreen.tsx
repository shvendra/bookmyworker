import React, { useState } from 'react';
import { FlatList, RefreshControl, StatusBar, StyleSheet, View } from 'react-native';
import { showAlert } from '../../../shared/state/alert/AppAlertContext';
import { useToast } from '../../../shared/state/toast/ToastContext';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppTheme } from '../../../core/theme';
import { workerApi } from '../../../core/api/endpoints/workerApi';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppCard } from '../../../shared/components/ui/AppCard';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { StatCard } from '../../../shared/components/ui/StatCard';
import { Badge, statusToBadgeVariant } from '../../../shared/components/ui/Badge';
import { SectionHeader } from '../../../shared/components/ui/SectionHeader';
import { LoadingState } from '../../../shared/components/feedback/LoadingState';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { EmptyState } from '../../../shared/components/feedback/EmptyState';
import type { AttendanceRecord } from '../../../shared/types/domain';

const formatTime = (iso?: string): string => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
};

export const AttendanceScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: records, isLoading, isError, refetch } = useQuery({
    queryKey: ['attendance-my'],
    queryFn: () => workerApi.getAttendance(),
    staleTime: 60 * 1000,
    placeholderData: __DEV__
      ? ([
          {
            id: 'att-1',
            workerId: 'me',
            workerName: 'Demo Worker',
            requirementId: 'req-1',
            requirementTitle: 'Construction Site A',
            date: new Date().toISOString().split('T')[0] ?? '',
            checkIn: '08:30',
            checkOut: '17:30',
            hoursWorked: 9,
            status: 'present' as const,
          },
        ] as AttendanceRecord[])
      : undefined,
  });

  const checkInMutation = useMutation({
    mutationFn: (requirementId: string) =>
      workerApi.markAttendance({ requirementId, type: 'check-in' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['attendance-my'] });
      void queryClient.invalidateQueries({ queryKey: ['worker-dashboard'] });
      toast.success('Your check-in has been recorded for today.', 'Checked In ✓');
    },
    onError: () => toast.error('Could not mark attendance. Please try again.', 'Check-In Failed'),
  });

  const checkOutMutation = useMutation({
    mutationFn: (requirementId: string) =>
      workerApi.markAttendance({ requirementId, type: 'check-out' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['attendance-my'] });
      toast.success('Your check-out has been recorded for today.', 'Checked Out ✓');
    },
    onError: () => toast.error('Could not mark check-out. Please try again.', 'Check-Out Failed'),
  });

  const attendanceList: AttendanceRecord[] = records ?? [];
  const today = new Date().toISOString().split('T')[0];
  const todayRecord = attendanceList.find((r) => r.date === today);

  const presentDays = attendanceList.filter((r) => r.status === 'present').length;
  const absentDays = attendanceList.filter((r) => r.status === 'absent').length;
  const halfDays = attendanceList.filter((r) => r.status === 'half-day').length;

  if (isLoading && !records) return <LoadingState message="Loading attendance…" />;
  if (isError) return <ErrorState title="Unable to Load Attendance" message="Could not fetch attendance records. Please check your connection and try again." onRetry={() => void refetch()} />;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="#1037A4" />
      <ScreenHeader title="Attendance" />
    <FlatList
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => void refetch()} />}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={() => (
        <>
          <AppText variant="title" style={styles.title}>Attendance</AppText>

          {/* Today's Card */}
          <AppCard style={[styles.todayCard, { backgroundColor: todayRecord ? theme.colors.success : theme.colors.card }]}>
            <AppText variant="label" color={todayRecord ? '#FFFFFF' : theme.colors.text}>
              Today — {today}
            </AppText>
            {todayRecord ? (
              <>
                <AppText variant="body" color="#FFFFFF" style={styles.topGap}>
                  Check-in: {formatTime(todayRecord.checkIn)}
                  {todayRecord.checkOut ? `  |  Check-out: ${formatTime(todayRecord.checkOut)}` : ''}
                </AppText>
                {todayRecord.hoursWorked ? (
                  <AppText variant="caption" color="rgba(255,255,255,0.8)" style={styles.topGap}>
                    {todayRecord.hoursWorked} hrs worked
                  </AppText>
                ) : null}
              </>
            ) : (
              <AppText variant="body" color={theme.colors.mutedText} style={styles.topGap}>
                Not checked in yet today.
              </AppText>
            )}
            <View style={styles.actionRow}>
              {!todayRecord?.checkIn ? (
                <AppButton
                  title="Check In"
                  onPress={() => {
                    showAlert(
                      'Check In',
                      'Mark attendance for your current requirement?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Check In', onPress: () => checkInMutation.mutate('current') },
                      ]
                    );
                  }}
                  loading={checkInMutation.isPending}
                  style={styles.actionBtn}
                />
              ) : !todayRecord.checkOut ? (
                <AppButton
                  title="Check Out"
                  onPress={() => {
                    showAlert(
                      'Check Out',
                      'Record your check-out for today?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Check Out', onPress: () => checkOutMutation.mutate('current') },
                      ]
                    );
                  }}
                  loading={checkOutMutation.isPending}
                  variant="ghost"
                  style={styles.actionBtn}
                />
              ) : null}
            </View>
          </AppCard>

          {/* Monthly Stats */}
          <SectionHeader title="This Month" />
          <View style={styles.statsGrid}>
            <StatCard label="Present" value={presentDays} color={theme.colors.success} />
            <StatCard label="Absent" value={absentDays} color={theme.colors.danger} />
            <StatCard label="Half Day" value={halfDays} color={theme.colors.warning} />
            <StatCard
              label="Total"
              value={attendanceList.length}
              color={theme.colors.primary}
            />
          </View>

          <SectionHeader title="Attendance History" />
        </>
      )}
      data={attendanceList}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <AppCard style={styles.recordCard}>
          <View style={styles.recordRow}>
            <View style={styles.recordInfo}>
              <AppText variant="label">{item.date}</AppText>
              <AppText variant="caption" color={theme.colors.mutedText}>
                {item.requirementTitle}
              </AppText>
              <AppText variant="caption" color={theme.colors.mutedText}>
                In: {formatTime(item.checkIn)}  Out: {formatTime(item.checkOut)}
                {item.hoursWorked ? `  (${item.hoursWorked}h)` : ''}
              </AppText>
            </View>
            <Badge label={item.status} variant={statusToBadgeVariant(item.status)} />
          </View>
        </AppCard>
      )}
      ListEmptyComponent={() => (
        <EmptyState title="No attendance records" message="Your attendance history will appear here." />
      )}
    />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  title: { marginBottom: 16 },
  todayCard: { marginBottom: 20, padding: 16 },
  topGap: { marginTop: 6 },
  actionRow: { marginTop: 12 },
  actionBtn: { alignSelf: 'flex-start' },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  recordCard: { marginBottom: 8 },
  recordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  recordInfo: { flex: 1, gap: 2 },
});
