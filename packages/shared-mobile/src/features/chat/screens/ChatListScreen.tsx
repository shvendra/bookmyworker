import React, { useEffect, useState } from 'react';
import { FlatList, RefreshControl, StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAppTheme } from '../../../core/theme';
import { chatApi } from '../../../core/api/endpoints/chatApi';
import { useAuth } from '../../../state/auth/AuthContext';
import { AppText } from '../../../shared/components/ui/AppText';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { Avatar } from '../../../shared/components/ui/Avatar';
import { LoadingState } from '../../../shared/components/feedback/LoadingState';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { EmptyState } from '../../../shared/components/feedback/EmptyState';
import { useTranslation } from 'react-i18next';
import type { ChatRoom } from '../../../shared/types/domain';

interface ChatListScreenProps {
  onOpenRoom?: (room: ChatRoom) => void;
}

const formatTime = (iso?: string): string => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  } catch {
    return '';
  }
};

export const ChatListScreen = ({ onOpenRoom }: ChatListScreenProps): React.JSX.Element => {
  const { t } = useTranslation('employer');
  const { theme } = useAppTheme();
  const { state } = useAuth();
  const userId = state.session?.user.id ?? '';

  // Backend has no room-list endpoint; rooms are opened from requirement screens.
  const { isLoading, isError, refetch } = useQuery({
    queryKey: ['chat-rooms', userId],
    queryFn: () => chatApi.getUnreadCounts(userId),
    staleTime: 30 * 1000,
    enabled: !!userId,
  });

  const roomList: ChatRoom[] = [];

  if (isLoading) return <LoadingState message={t('loading')} />;
  if (isError) return <ErrorState title={t('error')} message={t('checkConnectionRetry')} onRetry={() => void refetch()} />;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="#1037A4" />
      <ScreenHeader title={t('chatTitle')} />

      {roomList.length === 0 ? (
        <EmptyState
          title={t('noChats')}
          message={t('noChatsDesc')}
        />
      ) : (
        <FlatList
          data={roomList}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={() => void refetch()} />
          }
          renderItem={({ item }) => {
            const otherUserId = item.participants.find((p) => p !== userId) ?? '';
            const name = item.participantNames[otherUserId] ?? t('jp_user');
            const avatarUri = item.participantImages?.[otherUserId];
            return (
              <TouchableOpacity
                style={[styles.roomItem, { borderBottomColor: theme.colors.border }]}
                onPress={() => onOpenRoom?.(item)}
                activeOpacity={0.7}
              >
                <View style={styles.avatarWrap}>
                  <Avatar name={name} uri={avatarUri} size={50} />
                  {item.unreadCount > 0 && (
                    <View style={[styles.unreadDot, { backgroundColor: theme.colors.primary }]}>
                      <AppText variant="caption" color="#FFFFFF" style={styles.unreadText}>
                        {item.unreadCount > 9 ? '9+' : item.unreadCount}
                      </AppText>
                    </View>
                  )}
                </View>
                <View style={styles.roomInfo}>
                  <View style={styles.roomTop}>
                    <AppText variant="label" numberOfLines={1} style={styles.roomName}>
                      {name}
                    </AppText>
                    <AppText variant="caption" color={theme.colors.mutedText}>
                      {formatTime(item.lastMessageAt)}
                    </AppText>
                  </View>
                  <AppText
                    variant="caption"
                    color={item.unreadCount > 0 ? theme.colors.text : theme.colors.mutedText}
                    numberOfLines={1}
                    style={item.unreadCount > 0 ? styles.boldCaption : undefined}
                  >
                    {item.lastMessage ?? t('noChats')}
                  </AppText>
                </View>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { flexGrow: 1 },
  roomItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatarWrap: { position: 'relative' },
  unreadDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: { fontSize: 10, lineHeight: 12 },
  roomInfo: { flex: 1, gap: 4 },
  roomTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roomName: { flex: 1, marginRight: 8 },
  boldCaption: { fontWeight: '600' },
});
