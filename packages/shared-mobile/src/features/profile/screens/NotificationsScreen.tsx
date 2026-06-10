import React from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppTheme } from '../../../core/theme';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { notificationApi, type NotificationItem } from '../../../core/api/endpoints/notificationApi';
import { useToast } from '../../../shared/state/toast/ToastContext';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { buildPhotoUrl } from '../../../core/config/env';

// Replace underscores with spaces so work-type names display cleanly
// e.g. "transport_logistics_workers" → "transport logistics workers"
const cleanText = (text?: string): string =>
  (text ?? '').replace(/_/g, ' ');

const TYPE_META: Record<string, { icon: string; bg: string; iconColor: string }> = {
  requirement: { icon: '📋', bg: '#EFF6FF', iconColor: '#1A56DB' },
  interest:    { icon: '🤝', bg: '#F3EFFE', iconColor: '#7C3AED' },
  payment:     { icon: '💰', bg: '#ECFDF5', iconColor: '#059669' },
  payout:      { icon: '💸', bg: '#FFFBEB', iconColor: '#D97706' },
  kyc:         { icon: '🪪', bg: '#F0FFFE', iconColor: '#0891B2' },
  chat:        { icon: '💬', bg: '#F5F3FF', iconColor: '#7C3AED' },
  system:      { icon: '🔔', bg: '#F8FAFC', iconColor: '#64748B' },
  newWorker:   { icon: '👷', bg: '#FFF7ED', iconColor: '#EA580C' },
};

const formatTime = (iso: string, t: TFunction): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('pf_justNow');
  if (mins < 60) return t('pf_minAgo', { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('pf_hrAgo', { n: hours });
  const days = Math.floor(hours / 24);
  if (days === 1) return t('pf_yesterday');
  return t('pf_dayAgo', { n: days });
};

// Stable date-group keys (used for ordering); labels resolved via t() at render.
const DATE_GROUP_ORDER = ['today', 'yesterday', 'thisWeek', 'earlier'] as const;
type DateGroupKey = typeof DATE_GROUP_ORDER[number];
const DATE_GROUP_LABEL_KEY: Record<DateGroupKey, string> = {
  today: 'pf_today', yesterday: 'pf_yesterday', thisWeek: 'pf_thisWeek', earlier: 'pf_earlier',
};

const getDateGroup = (iso: string): DateGroupKey => {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return 'thisWeek';
  return 'earlier';
};

// ── Worker mini-profile for newWorker notifications ────────────────────────────
interface WorkerData {
  workerName?: string;
  workerPhoto?: string;
  workerGender?: string;
  workerAge?: number;
  workerProfession?: string;
  workerLocation?: string;
}

const genderAvatar = (gender?: string): { bg: string; textColor: string; initials: string } => {
  const g = (gender ?? '').toLowerCase();
  if (g === 'female' || g === 'f') return { bg: '#FCE7F3', textColor: '#BE185D', initials: '♀' };
  if (g === 'male' || g === 'm') return { bg: '#DBEAFE', textColor: '#1D4ED8', initials: '♂' };
  return { bg: '#F1F5F9', textColor: '#475569', initials: '?' };
};

const WorkerMiniProfile = ({ data }: { data: WorkerData }): React.JSX.Element => {
  const { t } = useTranslation('employer');
  const photoUri = data.workerPhoto ? buildPhotoUrl(data.workerPhoto) : null;
  const avatar = genderAvatar(data.workerGender);
  const initials = data.workerName ? data.workerName.charAt(0).toUpperCase() : avatar.initials;

  return (
    <View style={wp.row}>
      {/* Avatar */}
      <View style={[wp.avatarWrap, { backgroundColor: avatar.bg, borderColor: avatar.textColor + '30' }]}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={wp.avatarImg} resizeMode="cover" />
        ) : (
          <AppText style={[wp.avatarInitial, { color: avatar.textColor }]}>{initials}</AppText>
        )}
      </View>

      {/* Info */}
      <View style={wp.info}>
        {data.workerName ? (
          <AppText style={wp.name} numberOfLines={1}>{data.workerName}</AppText>
        ) : null}
        <View style={wp.chips}>
          {data.workerAge ? (
            <View style={[wp.chip, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
              <AppText style={[wp.chipTxt, { color: '#1D4ED8' }]}>{t('pf_yrs', { n: data.workerAge })}</AppText>
            </View>
          ) : null}
          {data.workerProfession ? (
            <View style={[wp.chip, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}>
              <AppText style={[wp.chipTxt, { color: '#C2410C' }]} numberOfLines={1}>{data.workerProfession}</AppText>
            </View>
          ) : null}
          {data.workerLocation ? (
            <View style={[wp.chip, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
              <AppText style={[wp.chipTxt, { color: '#15803D' }]} numberOfLines={1}>📍 {data.workerLocation}</AppText>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
};

const wp = StyleSheet.create({
  row:           { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E2E8F0' },
  avatarWrap:    { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  avatarImg:     { width: 44, height: 44, borderRadius: 22 },
  avatarInitial: { fontSize: 18, fontWeight: '700', lineHeight: 22 },
  info:          { flex: 1, gap: 5 },
  name:          { fontSize: 13, fontWeight: '800', color: '#0F172A', textTransform: 'capitalize' },
  chips:         { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  chip:          { borderRadius: 6, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  chipTxt:       { fontSize: 10, fontWeight: '700' },
});

// ── Notification card ───────────────────────────────────────────────────────────
interface NotifCardProps {
  item: NotificationItem;
  onPress: (id: string) => void;
  isLast: boolean;
}

const NotifCard = ({ item, onPress, isLast }: NotifCardProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
  const meta = TYPE_META[item.type] ?? TYPE_META.system!;
  const isUnread = !item.read;
  const isNewWorker = item.type === 'newWorker';
  const workerData = isNewWorker ? (item.data as WorkerData) : null;

  return (
    <TouchableOpacity
      onPress={() => onPress(item._id)}
      activeOpacity={0.75}
      style={[
        styles.card,
        {
          backgroundColor: isUnread
            ? (theme.mode === 'dark' ? theme.colors.primary + '14' : '#F5F8FF')
            : theme.colors.card,
          borderColor: theme.colors.border,
          borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      {/* Unread left accent */}
      {isUnread && (
        <View style={[styles.unreadBar, { backgroundColor: theme.colors.primary }]} />
      )}

      <View style={styles.cardInner}>
        <View style={styles.topRow}>
          {/* Icon circle */}
          <View style={[styles.iconCircle, { backgroundColor: theme.mode === 'dark' ? theme.colors.surface1 : meta.bg }]}>
            <AppText style={styles.iconEmoji}>{meta.icon}</AppText>
            {isUnread && (
              <View style={[styles.unreadDot, { backgroundColor: theme.colors.danger }]} />
            )}
          </View>

          {/* Body */}
          <View style={styles.body}>
            <View style={styles.titleRow}>
              <AppText
                variant="label"
                color={theme.colors.text}
                numberOfLines={2}
                style={[styles.titleText, isUnread && { fontWeight: '700' }]}
              >
                {cleanText(item.title)}
              </AppText>
              <AppText variant="micro" color={theme.colors.mutedText} style={styles.time}>
                {formatTime(item.createdAt, t)}
              </AppText>
            </View>
            <AppText variant="caption" color={theme.colors.mutedText} style={styles.bodyText} numberOfLines={3}>
              {cleanText(item.body)}
            </AppText>
          </View>
        </View>

        {/* Worker mini-profile for newWorker type */}
        {isNewWorker && workerData ? (
          <WorkerMiniProfile data={workerData} />
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

interface Section {
  groupKey: DateGroupKey;
  data: NotificationItem[];
}

const groupByDate = (items: NotificationItem[]): Section[] => {
  const groups: Partial<Record<DateGroupKey, NotificationItem[]>> = {};
  items.forEach((item) => {
    const group = getDateGroup(item.createdAt);
    if (!groups[group]) groups[group] = [];
    groups[group]!.push(item);
  });
  return DATE_GROUP_ORDER.filter((k) => groups[k]).map((k) => ({ groupKey: k, data: groups[k]! }));
};

export const NotificationsScreen = (): React.JSX.Element => {
  const { t } = useTranslation('employer');
  const { theme } = useAppTheme();
  const navigation = useNavigation();
  const qc = useQueryClient();
  const toast = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationApi.getNotifications({ limit: 50 }),
    staleTime: 30_000,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => notificationApi.markRead(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['notifications'] }),
    onError: () => toast.error(t('pf_markReadError')),
  });

  const markAllRead = useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications'] });
      toast.success(t('pf_allMarkedRead'), t('pf_actDone'));
    },
    onError: () => toast.error(t('pf_markAllError')),
  });

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;
  const sections = groupByDate(notifications);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="#1037A4" />
      <ScreenHeader
        title={t('notificationsTitle')}
        onBack={() => navigation.goBack()}
        rightIcon={unreadCount > 0 ? '✓' : undefined}
        onRightPress={unreadCount > 0 ? () => markAllRead.mutate() : undefined}
      />

      {notifications.length === 0 ? (
        <View style={styles.empty}>
          <View style={[styles.emptyIconCircle, { backgroundColor: theme.colors.primaryLight }]}>
            <AppText style={styles.emptyIcon}>🔔</AppText>
          </View>
          <AppText variant="subtitle" color={theme.colors.text} style={styles.emptyTitle}>
            {t('noNotifications')}
          </AppText>
          <AppText variant="body" color={theme.colors.mutedText} center style={styles.emptyMsg}>
            {t('noNotifications')}
          </AppText>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
        >
          {sections.map((section) => (
            <View key={section.groupKey} style={styles.sectionWrap}>
              {/* Section date label */}
              <View style={styles.sectionHeaderWrap}>
                <AppText variant="micro" color={theme.colors.mutedText} style={styles.sectionLabel}>
                  {t(DATE_GROUP_LABEL_KEY[section.groupKey]).toUpperCase()}
                </AppText>
                <View style={[styles.sectionLine, { backgroundColor: theme.colors.border }]} />
              </View>

              {/* Card container for this section's items */}
              <View
                style={[
                  styles.sectionCard,
                  {
                    backgroundColor: theme.colors.card,
                    borderColor: theme.mode === 'dark' ? theme.colors.border : '#E2E8F4',
                    shadowColor: '#8896B0',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.06,
                    shadowRadius: 8,
                    elevation: 2,
                  },
                ]}
              >
                {section.data.map((item, index) => (
                  <NotifCard
                    key={item._id}
                    item={item}
                    onPress={(id) => markRead.mutate(id)}
                    isLast={index === section.data.length - 1}
                  />
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  list: { padding: 16, paddingBottom: 40 },

  sectionHeaderWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    marginTop: 4,
  },
  sectionLabel: { letterSpacing: 0.8, fontWeight: '700' },
  sectionLine: { flex: 1, height: StyleSheet.hairlineWidth },
  sectionWrap: { marginBottom: 16 },

  sectionCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 0,
  },

  card: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    position: 'relative',
  },
  cardInner: { flexDirection: 'column' },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  unreadBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    position: 'relative',
  },
  iconEmoji: { fontSize: 20, lineHeight: 24 },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  body: { flex: 1, gap: 3 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  titleText: { flex: 1 },
  time: { flexShrink: 0, marginTop: 1 },
  bodyText: { lineHeight: 18 },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 12,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyIcon: { fontSize: 36, lineHeight: 42 },
  emptyTitle: { fontSize: 20 },
  emptyMsg: { textAlign: 'center', lineHeight: 22, maxWidth: 260 },
});
