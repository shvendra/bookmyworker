import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppTheme } from '../../../core/theme';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { notificationApi, type NotificationItem } from '../../../core/api/endpoints/notificationApi';

const TYPE_META: Record<string, { icon: string; bg: string; iconColor: string }> = {
  requirement: { icon: '📋', bg: '#EFF6FF', iconColor: '#1A56DB' },
  interest:    { icon: '🤝', bg: '#F3EFFE', iconColor: '#7C3AED' },
  payment:     { icon: '💰', bg: '#ECFDF5', iconColor: '#059669' },
  payout:      { icon: '💸', bg: '#FFFBEB', iconColor: '#D97706' },
  kyc:         { icon: '🪪', bg: '#F0FFFE', iconColor: '#0891B2' },
  chat:        { icon: '💬', bg: '#F5F3FF', iconColor: '#7C3AED' },
  system:      { icon: '🔔', bg: '#F8FAFC', iconColor: '#64748B' },
};

const formatTime = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
};

const getDateGroup = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return 'This Week';
  return 'Earlier';
};

interface NotifCardProps {
  item: NotificationItem;
  onPress: (id: string) => void;
  isLast: boolean;
}

const NotifCard = ({ item, onPress, isLast }: NotifCardProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const meta = TYPE_META[item.type] ?? TYPE_META.system!;
  const isUnread = !item.read;

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
            numberOfLines={1}
            style={[styles.titleText, isUnread && { fontWeight: '700' }]}
          >
            {item.title}
          </AppText>
          <AppText variant="micro" color={theme.colors.mutedText} style={styles.time}>
            {formatTime(item.createdAt)}
          </AppText>
        </View>
        <AppText variant="caption" color={theme.colors.mutedText} style={styles.bodyText} numberOfLines={2}>
          {item.body}
        </AppText>
      </View>
    </TouchableOpacity>
  );
};

interface Section {
  title: string;
  data: NotificationItem[];
}

const groupByDate = (items: NotificationItem[]): Section[] => {
  const groups: Record<string, NotificationItem[]> = {};
  const ORDER = ['Today', 'Yesterday', 'This Week', 'Earlier'];
  items.forEach((item) => {
    const group = getDateGroup(item.createdAt);
    if (!groups[group]) groups[group] = [];
    groups[group]!.push(item);
  });
  return ORDER.filter((k) => groups[k]).map((k) => ({ title: k, data: groups[k]! }));
};

export const NotificationsScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationApi.getNotifications({ limit: 50 }),
    staleTime: 30_000,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => notificationApi.markRead(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['notifications'] }),
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
      <StatusBar barStyle="light-content" backgroundColor="#1338B0" />
      <ScreenHeader
        title="Notifications"
        rightIcon={unreadCount > 0 ? '✓' : undefined}
        onRightPress={unreadCount > 0 ? () => markAllRead.mutate() : undefined}
      />

      {notifications.length === 0 ? (
        <View style={styles.empty}>
          <View style={[styles.emptyIconCircle, { backgroundColor: theme.colors.primaryLight }]}>
            <AppText style={styles.emptyIcon}>🔔</AppText>
          </View>
          <AppText variant="subtitle" color={theme.colors.text} style={styles.emptyTitle}>
            All caught up!
          </AppText>
          <AppText variant="body" color={theme.colors.mutedText} center style={styles.emptyMsg}>
            You have no notifications. We'll alert you when something needs your attention.
          </AppText>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
        >
          {sections.map((section) => (
            <View key={section.title} style={styles.sectionWrap}>
              {/* Section date label */}
              <View style={styles.sectionHeaderWrap}>
                <AppText variant="micro" color={theme.colors.mutedText} style={styles.sectionLabel}>
                  {section.title.toUpperCase()}
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    position: 'relative',
  },
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
