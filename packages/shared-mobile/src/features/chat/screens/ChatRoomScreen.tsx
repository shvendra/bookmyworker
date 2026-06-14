import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { showAlert } from '../../../shared/state/alert/AppAlertContext';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../../core/theme';
import { chatApi } from '../../../core/api/endpoints/chatApi';
import { socketService, type SocketStatus } from '../../../core/realtime/socketService';
import { useAuth } from '../../../state/auth/AuthContext';
import { AppText } from '../../../shared/components/ui/AppText';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { LoadingState } from '../../../shared/components/feedback/LoadingState';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { useTranslation } from 'react-i18next';
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
}): React.JSX.Element => {
  const { t } = useTranslation('employer');
  return (
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
            {item.fileName ?? t('jp_file')}
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
  );
});
MessageBubble.displayName = 'MessageBubble';

export const ChatRoomScreen = ({ roomId, roomName, hideBack, onBack }: ChatRoomScreenProps): React.JSX.Element => {
  const { t } = useTranslation('employer');
  const { theme } = useAppTheme();
  const { state } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const userId = state.session?.user.id ?? '';
  const token  = state.session?.tokens.accessToken ?? '';
  // Support rooms get a translated title regardless of the (English) roomName param
  // passed by callers; person-to-person rooms keep the other party's name as-is.
  const isSupportRoom = roomId.startsWith('support_');
  const headerTitle = isSupportRoom ? t('supportChat') : roomName;
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [socketStatus, setSocketStatus] = useState<SocketStatus>('connected');
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
      } catch {
        setLoadError(true);
      } finally { setInitialLoading(false); }
    };
    void load();
  }, [roomId]);

  // Socket setup — connect, join room, listen for messages
  useEffect(() => {
    if (!token || !roomId) return;

    socketService.connect(token);
    socketService.setStatusHandler(setSocketStatus);
    socketService.joinRoom(roomId);
    socketService.markMessagesRead(roomId, userId);

    const handler = (msg: Record<string, unknown>): void => {
      if ((msg.roomId as string) !== roomId) return;
      const msgId = (msg._id ?? `${msg.sender}-${msg.timestamp}`) as string;
      // Already handled this exact server id (guards against duplicate broadcasts).
      if (localIds.current.has(msgId)) return;
      localIds.current.add(msgId);

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
      setMessages((prev) => {
        // Echo of our OWN message: replace the optimistic copy (client id `local-…`)
        // with the server-confirmed one instead of duplicating. Match by media URL
        // for attachments, else by text.
        if (newMsg.senderId === userId) {
          const idx = prev.findIndex(
            (m) => m.id.startsWith('local-') && m.senderId === userId && (
              newMsg.mediaUrl ? m.mediaUrl === newMsg.mediaUrl : (!m.mediaUrl && m.text === newMsg.text)
            ),
          );
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = newMsg;
            return next;
          }
        }
        // Safety net: never add a message whose id is already present.
        if (prev.some((m) => m.id === msgId)) return prev;
        return [newMsg, ...prev];
      });
      socketService.markMessagesRead(roomId, userId);
    };

    socketService.onMessage(handler as Parameters<typeof socketService.onMessage>[0]);

    return () => {
      socketService.offMessage(handler as Parameters<typeof socketService.offMessage>[0]);
      socketService.setStatusHandler(null);
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
      showAlert(t('jp_uploadFailed'), t('jp_couldNotUploadFile'));
    } finally { setUploadingMedia(false); }
  }, [roomId, userId, t]);

  const handleAttach = useCallback((): void => {
    showAlert(t('jp_attach'), t('jp_chooseAttachType'), [
      {
        text: t('jp_photoImage'),
        onPress: async () => {
          try {
            const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
            if (result.canceled || !result.assets[0]) return;
            const asset = result.assets[0];
            const ext = asset.uri.split('.').pop() ?? 'jpg';
            await uploadAndSend({ uri: asset.uri, name: `chat_image_${Date.now()}.${ext}`, type: asset.mimeType ?? `image/${ext}` });
          } catch {
            setUploadingMedia(false);
            showAlert(t('jp_uploadFailed'), t('jp_couldNotSendImage'));
          }
        },
      },
      {
        text: t('jp_fileDocument'),
        onPress: async () => {
          try {
            const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
            if (result.canceled || !result.assets?.[0]) return;
            const asset = result.assets[0];
            await uploadAndSend({ uri: asset.uri, name: asset.name, type: asset.mimeType ?? 'application/octet-stream' });
          } catch {
            setUploadingMedia(false);
            showAlert(t('jp_uploadFailed'), t('jp_couldNotSendFile'));
          }
        },
      },
      { text: t('jp_cancel'), style: 'cancel' },
    ]);
  }, [uploadAndSend, t]);

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

  if (initialLoading) return <LoadingState message={t('loading')} />;
  if (loadError) {
    return (
      <ErrorState
        title={t('error')}
        description={t('checkConnectionRetry')}
        onRetry={() => {
          setLoadError(false);
          setInitialLoading(true);
          void (async () => {
            try {
              const data = await chatApi.getMessages(roomId, 1, 20);
              setMessages([...data.messages].reverse());
              setTotalPages(data.pages);
              setCurrentPage(1);
            } catch { setLoadError(true); }
            finally { setInitialLoading(false); }
          })();
        }}
      />
    );
  }

  const hasOlderMessages = currentPage < totalPages;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top + 56}
    >
      <StatusBar barStyle="light-content" backgroundColor="#1037A4" />
      <ScreenHeader
        title={headerTitle}
        onBack={hideBack && !onBack ? undefined : (onBack ?? (() => navigation.goBack()))}
      />

      {socketStatus !== 'connected' && (
        <View style={styles.reconnectBar}>
          <AppText style={styles.reconnectTxt}>{t('socketReconnecting', { ns: 'translation' })}</AppText>
        </View>
      )}

      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={(item) => item.id}
        inverted={messages.length > 0}
        contentContainerStyle={[styles.messageList, messages.length === 0 && styles.messageListEmpty]}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={[styles.emptyIconCircle, { backgroundColor: theme.colors.primaryLight }]}>
              <AppText style={styles.emptyIcon}>{isSupportRoom ? '🎧' : '💬'}</AppText>
            </View>
            <AppText variant="subtitle" color={theme.colors.text} center style={styles.emptyTitle}>
              {isSupportRoom ? t('supportEmptyTitle') : t('chatEmptyTitle')}
            </AppText>
            <AppText variant="body" color={theme.colors.mutedText} center style={styles.emptySubtitle}>
              {isSupportRoom ? t('supportEmptySubtitle') : t('chatEmptySubtitle')}
            </AppText>
          </View>
        }
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
                  {t('loadMore')}
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
          placeholder={t('typeMessage')}
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
  messageListEmpty: { flexGrow: 1, justifyContent: 'center' },

  emptyWrap:       { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, gap: 10 },
  emptyIconCircle: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyIcon:       { fontSize: 38, lineHeight: 46 },
  emptyTitle:      { fontSize: 18, lineHeight: 24 },
  emptySubtitle:   { lineHeight: 22, maxWidth: 300 },

  reconnectBar: { backgroundColor: '#FEF3C7', paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
  reconnectTxt: { fontSize: 12, fontWeight: '700', color: '#92400E' },

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
