import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useAppTheme } from '../../../core/theme';
import { chatApi } from '../../../core/api/endpoints/chatApi';
import { socketService } from '../../../core/realtime/socketService';
import { useAuth } from '../../../state/auth/AuthContext';
import { AppText } from '../../../shared/components/ui/AppText';
import { Avatar } from '../../../shared/components/ui/Avatar';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { LoadingState } from '../../../shared/components/feedback/LoadingState';
import type { ChatMessage } from '../../../shared/types/domain';

interface ChatRoomScreenProps {
  roomId: string;
  roomName: string;
  roomAvatar?: string;
}

const formatTime = (iso: string): string => {
  try {
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

export const ChatRoomScreen = ({ roomId, roomName, roomAvatar }: ChatRoomScreenProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { state } = useAuth();
  const navigation = useNavigation();
  const userId = state.session?.user.id ?? '';
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const flatRef = useRef<FlatList>(null);

  const { isLoading, data: messagesData } = useQuery({
    queryKey: ['chat-messages', roomId],
    queryFn: () => chatApi.getMessages(roomId),
    staleTime: 30 * 1000,
  });

  React.useEffect(() => {
    if (messagesData?.messages) {
      setMessages(messagesData.messages);
    }
  }, [messagesData]);

  useEffect(() => {
    const token = state.session?.tokens.accessToken;
    if (!token || !roomId) return;

    socketService.connect(token);
    socketService.joinRoom(roomId);

    const handler = (msg: ChatMessage): void => {
      if (msg.roomId === roomId) {
        setMessages((prev) => [msg, ...prev]);
      }
    };
    socketService.onMessage(handler);

    return () => {
      socketService.offMessage(handler);
      socketService.leaveRoom(roomId);
    };
  }, [roomId, state.session?.tokens.accessToken]);

  const handleSend = useCallback(async (): Promise<void> => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft('');

    const optimistic: ChatMessage = {
      id: `local-${Date.now()}`,
      roomId,
      senderId: userId,
      text,
      createdAt: new Date().toISOString(),
      read: false,
    };
    setMessages((prev) => [optimistic, ...prev]);
    socketService.sendMessage(roomId, userId, text);

    try {
      await chatApi.sendMessage(roomId, userId, text);
    } catch {
      // socket message already sent; API failure is non-blocking
    } finally {
      setSending(false);
    }
  }, [draft, roomId, sending, userId]);

  if (isLoading) return <LoadingState message="Loading messages…" />;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <StatusBar barStyle="light-content" backgroundColor="#1338B0" />
      <ScreenHeader title={roomName} onBack={() => navigation.goBack()} />

      {/* Messages */}
      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={(item) => item.id}
        inverted
        contentContainerStyle={styles.messageList}
        renderItem={({ item }) => {
          const isMe = item.senderId === userId;
          return (
            <View style={[styles.bubble, isMe ? styles.bubbleRight : styles.bubbleLeft]}>
              <View
                style={[
                  styles.bubbleInner,
                  {
                    backgroundColor: isMe ? theme.colors.primary : theme.colors.card,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <AppText
                  variant="body"
                  color={isMe ? '#FFFFFF' : theme.colors.text}
                  style={styles.messageText}
                >
                  {item.text}
                </AppText>
                <AppText
                  variant="caption"
                  color={isMe ? 'rgba(255,255,255,0.7)' : theme.colors.mutedText}
                  style={styles.messageTime}
                >
                  {formatTime(item.createdAt)}
                </AppText>
              </View>
            </View>
          );
        }}
      />

      {/* Composer */}
      <View style={[styles.composer, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Type a message…"
          placeholderTextColor={theme.colors.mutedText}
          multiline
          style={[
            styles.textInput,
            {
              backgroundColor: theme.colors.background,
              borderColor: theme.colors.border,
              color: theme.colors.text,
            },
          ]}
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={() => void handleSend()}
        />
        <TouchableOpacity
          onPress={() => void handleSend()}
          disabled={!draft.trim() || sending}
          style={[
            styles.sendBtn,
            {
              backgroundColor:
                draft.trim() && !sending ? theme.colors.primary : theme.colors.border,
            },
          ]}
        >
          <AppText variant="label" color="#FFFFFF">
            ➤
          </AppText>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  messageList: {
    padding: 16,
    paddingBottom: 8,
  },
  bubble: {
    marginBottom: 8,
  },
  bubbleLeft: { alignItems: 'flex-start' },
  bubbleRight: { alignItems: 'flex-end' },
  bubbleInner: {
    maxWidth: '78%',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  messageText: { fontSize: 15 },
  messageTime: { marginTop: 4, fontSize: 11, alignSelf: 'flex-end' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 10,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  textInput: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 120,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
