import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../../../core/theme';
import { chatApi } from '../../../core/api/endpoints/chatApi';
import { socketService } from '../../../core/realtime/socketService';
import { useAuth } from '../../../state/auth/AuthContext';
import { AppText } from '../../../shared/components/ui/AppText';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { LoadingState } from '../../../shared/components/feedback/LoadingState';
import type { ChatMessage } from '../../../shared/types/domain';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

interface ChatRoomScreenProps {
  roomId: string;
  roomName: string;
  roomAvatar?: string;
  hideBack?: boolean;
  onBack?: () => void;
}

const formatTime = (iso: string): string => {
  try {
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

const MessageBubble = React.memo(({
  item, isMe, textColor, bubbleBg, bubbleBorder, mutedColor,
}: {
  item: ChatMessage; isMe: boolean;
  textColor: string; bubbleBg: string; bubbleBorder: string; mutedColor: string;
}): React.JSX.Element => (
  <View style={[styles.bubble, isMe ? styles.bubbleRight : styles.bubbleLeft]}>
    {!isMe && item.senderName ? (
      <AppText style={styles.senderName} numberOfLines={1}>{item.senderName}</AppText>
    ) : null}
    <View style={[styles.bubbleInner, { backgroundColor: bubbleBg, borderColor: bubbleBorder }]}>
      {item.mediaUrl && item.mediaType === 'image' ? (
        <Image source={{ uri: item.mediaUrl }} style={styles.mediaImage} resizeMode="cover" />
      ) : item.mediaUrl ? (
        <View style={styles.fileAttachment}>
          <AppText style={{ fontSize: 20 }}>📎</AppText>
          <AppText variant="caption" color={textColor} style={styles.fileName} numberOfLines={1}>
            {item.fileName ?? 'File'}
          </AppText>
        </View>
      ) : null}
      {!!item.text && (
        <AppText variant="body" color={textColor} style={styles.messageText}>
          {item.text}
        </AppText>
      )}
      <AppText variant="caption" color={mutedColor} style={styles.messageTime}>
        {formatTime(item.createdAt)}
      </AppText>
    </View>
  </View>
));
MessageBubble.displayName = 'MessageBubble';

export const ChatRoomScreen = ({ roomId, roomName, hideBack, onBack }: ChatRoomScreenProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { state } = useAuth();
  const navigation = useNavigation();
  const userId = state.session?.user.id ?? '';
  const token  = state.session?.tokens.accessToken ?? '';
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const flatRef = useRef<FlatList>(null);
  // Track local optimistic IDs to avoid duplicates from socket echo
  const localIds = useRef<Set<string>>(new Set());

  // Load initial messages (page 1 = most recent)
  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        const data = await chatApi.getMessages(roomId, 1, 20);
        // Backend returns oldest-first; for inverted FlatList we need newest-first
        setMessages([...data.messages].reverse());
        setTotalPages(data.pages);
        setCurrentPage(1);
      } catch { /* ignore */ }
      finally { setInitialLoading(false); }
    };
    void load();
  }, [roomId]);

  // Socket setup — connect, join room, listen for messages
  useEffect(() => {
    if (!token || !roomId) return;

    socketService.connect(token);
    socketService.joinRoom(roomId);
    socketService.markMessagesRead(roomId, userId);

    const handler = (msg: Record<string, unknown>): void => {
      if ((msg.roomId as string) !== roomId) return;
      // Skip echo of our own optimistic messages
      const msgId = (msg._id ?? `${msg.sender}-${msg.timestamp}`) as string;
      if (localIds.current.has(msgId)) return;

      const newMsg: ChatMessage = {
        id: msgId,
        roomId: msg.roomId as string,
        senderId: msg.sender as string,
        senderName: msg.senderName as string | undefined,
        text: (msg.message as string) ?? '',
        createdAt: (msg.timestamp as string) ?? new Date().toISOString(),
        read: false,
        mediaUrl: (msg.mediaUrl as string | null) ?? null,
        mediaType: (msg.mediaType as 'image' | 'file' | null) ?? null,
        fileName: (msg.fileName as string | null) ?? null,
      };
      setMessages((prev) => [newMsg, ...prev]);
      socketService.markMessagesRead(roomId, userId);
    };

    socketService.onMessage(handler as Parameters<typeof socketService.onMessage>[0]);

    return () => {
      socketService.offMessage(handler as Parameters<typeof socketService.offMessage>[0]);
      socketService.leaveRoom(roomId);
    };
  }, [roomId, token, userId]);

  const handleLoadOlder = useCallback(async (): Promise<void> => {
    if (loadingOlder || currentPage >= totalPages) return;
    setLoadingOlder(true);
    try {
      const nextPage = currentPage + 1;
      const data = await chatApi.getMessages(roomId, nextPage, 20);
      // Older messages go to end of array (bottom of inverted list = top of visible)
      setMessages((prev) => [...prev, ...[...data.messages].reverse()]);
      setCurrentPage(nextPage);
    } catch { /* ignore */ }
    finally { setLoadingOlder(false); }
  }, [loadingOlder, currentPage, totalPages, roomId]);

  const uploadAndSend = useCallback(async (file: { uri: string; name: string; type: string }): Promise<void> => {
    setUploadingMedia(true);
    try {
      const uploaded = await chatApi.uploadMedia(file);
      const localId = `local-${Date.now()}`;
      localIds.current.add(localId);
      const optimistic: ChatMessage = {
        id: localId,
        roomId,
        senderId: userId,
        text: '',
        createdAt: new Date().toISOString(),
        read: false,
        mediaUrl: uploaded.url,
        mediaType: uploaded.mediaType,
        fileName: uploaded.fileName,
      };
      setMessages((prev) => [optimistic, ...prev]);
      // Send via socket only — backend saves it and broadcasts to room
      socketService.sendMessage(roomId, userId, '', {
        mediaUrl: uploaded.url,
        mediaType: uploaded.mediaType,
        fileName: uploaded.fileName,
      });
    } catch {
      Alert.alert('Upload failed', 'Could not upload file. Please try again.');
    } finally { setUploadingMedia(false); }
  }, [roomId, userId]);

  const handleAttach = useCallback((): void => {
    Alert.alert('Attach', 'Choose attachment type', [
      {
        text: '📷  Photo / Image',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') { Alert.alert('Permission denied', 'Allow photo access to send images.'); return; }
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
          if (result.canceled || !result.assets[0]) return;
          const asset = result.assets[0];
          const ext = asset.uri.split('.').pop() ?? 'jpg';
          await uploadAndSend({ uri: asset.uri, name: `chat_image_${Date.now()}.${ext}`, type: asset.mimeType ?? `image/${ext}` });
        },
      },
      {
        text: '📄  File / Document',
        onPress: async () => {
          const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
          if (result.canceled || !result.assets?.[0]) return;
          const asset = result.assets[0];
          await uploadAndSend({ uri: asset.uri, name: asset.name, type: asset.mimeType ?? 'application/octet-stream' });
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [uploadAndSend]);

  const handleSend = useCallback(async (): Promise<void> => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft('');

    const localId = `local-${Date.now()}`;
    localIds.current.add(localId);
    const optimistic: ChatMessage = {
      id: localId,
      roomId,
      senderId: userId,
      text,
      createdAt: new Date().toISOString(),
      read: false,
    };
    setMessages((prev) => [optimistic, ...prev]);
    // Send via socket only — backend handles DB save and broadcasts receive_message
    socketService.sendMessage(roomId, userId, text);
    setSending(false);
  }, [draft, roomId, sending, userId]);

  if (initialLoading) return <LoadingState message="Loading messages…" />;

  const hasOlderMessages = currentPage < totalPages;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <StatusBar barStyle="light-content" backgroundColor="#1037A4" />
      <ScreenHeader
        title={roomName}
        onBack={hideBack && !onBack ? undefined : (onBack ?? (() => navigation.goBack()))}
      />

      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={(item) => item.id}
        inverted
        contentContainerStyle={styles.messageList}
        ListFooterComponent={
          hasOlderMessages ? (
            <TouchableOpacity
              onPress={() => void handleLoadOlder()}
              disabled={loadingOlder}
              style={[styles.loadOlderBtn, { borderColor: theme.colors.border }]}
            >
              {loadingOlder ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <AppText variant="caption" color={theme.colors.primary} style={styles.loadOlderTxt}>
                  Load older messages
                </AppText>
              )}
            </TouchableOpacity>
          ) : null
        }
        renderItem={({ item }) => {
          const isMe = item.senderId === userId;
          return (
            <MessageBubble
              item={item}
              isMe={isMe}
              textColor={isMe ? '#FFFFFF' : theme.colors.text}
              bubbleBg={isMe ? theme.colors.primary : theme.colors.card}
              bubbleBorder={theme.colors.border}
              mutedColor={isMe ? 'rgba(255,255,255,0.7)' : theme.colors.mutedText}
            />
          );
        }}
      />

      {/* Composer */}
      <View style={[styles.composer, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
        <TouchableOpacity
          onPress={handleAttach}
          disabled={uploadingMedia || sending}
          style={[styles.attachBtn, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
        >
          {uploadingMedia ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <AppText style={{ fontSize: 20 }}>📎</AppText>
          )}
        </TouchableOpacity>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Type a message…"
          placeholderTextColor={theme.colors.mutedText}
          multiline
          style={[
            styles.textInput,
            { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text },
          ]}
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={() => void handleSend()}
        />
        <TouchableOpacity
          onPress={() => void handleSend()}
          disabled={!draft.trim() || sending}
          style={[styles.sendBtn, {
            backgroundColor: draft.trim() && !sending ? theme.colors.primary : theme.colors.border,
          }]}
        >
          <AppText variant="label" color="#FFFFFF">➤</AppText>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container:   { flex: 1 },
  messageList: { padding: 16, paddingBottom: 8 },

  senderName: { fontSize: 11, fontWeight: '700', color: '#2563eb', marginBottom: 2, marginLeft: 14 },

  bubble:      { marginBottom: 8 },
  bubbleLeft:  { alignItems: 'flex-start' },
  bubbleRight: { alignItems: 'flex-end' },
  bubbleInner: {
    maxWidth: '78%',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
    overflow: 'hidden',
  },
  messageText: { fontSize: 15 },
  messageTime: { marginTop: 4, fontSize: 11, alignSelf: 'flex-end' },

  mediaImage:     { width: 200, height: 160, borderRadius: 10, marginBottom: 6 },
  fileAttachment: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  fileName:       { flex: 1, fontSize: 12 },

  loadOlderBtn: {
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginVertical: 8,
  },
  loadOlderTxt: { fontWeight: '600' },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 10,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  attachBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
