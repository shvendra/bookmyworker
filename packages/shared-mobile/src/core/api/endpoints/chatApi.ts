import { apiClient } from '../client';
import type { ChatMessage } from '../../../shared/types/domain';

interface BackendMessage {
  _id?: string;
  sender: string;
  message: string;
  timestamp: string;
  readBy?: string[];
  mediaUrl?: string | null;
  mediaType?: 'image' | 'file' | null;
  fileName?: string | null;
}

function mapToFrontendMessage(m: BackendMessage, roomId: string): ChatMessage {
  return {
    id: m._id ?? `${m.sender}-${m.timestamp}`,
    roomId,
    senderId: m.sender,
    text: m.message,
    createdAt: m.timestamp,
    read: (m.readBy?.length ?? 0) > 0,
    mediaUrl: m.mediaUrl ?? null,
    mediaType: m.mediaType ?? null,
    fileName: m.fileName ?? null,
  };
}

interface MessagesResponse {
  messages: ChatMessage[];
  total: number;
  page: number;
  pages: number;
}

export const chatApi = {
  getMessages: async (roomId: string, page = 1, limit = 10): Promise<MessagesResponse> => {
    const response = await apiClient.get<{
      success: boolean;
      messages: BackendMessage[];
      total: number;
      page: number;
      pages: number;
    }>(`/api/v1/chat/${roomId}`, { params: { page, limit } });
    const messages = (response.data.messages ?? []).map((m) => mapToFrontendMessage(m, roomId));
    return {
      messages,
      total: response.data.total ?? messages.length,
      page: response.data.page ?? page,
      pages: response.data.pages ?? 1,
    };
  },

  sendMessage: (
    roomId: string,
    sender: string,
    text: string,
    media?: { mediaUrl: string; mediaType: 'image' | 'file'; fileName: string },
  ) =>
    apiClient
      .post(`/api/v1/chat/${roomId}`, { sender, message: text, ...media })
      .then((r) => r.data),

  uploadMedia: async (file: {
    uri: string;
    name: string;
    type: string;
  }): Promise<{ url: string; mediaType: 'image' | 'file'; fileName: string }> => {
    const formData = new FormData();
    formData.append('file', file as unknown as Blob);
    const res = await apiClient.post<{
      url: string;
      mediaType: 'image' | 'file';
      fileName: string;
    }>('/api/v1/chat/upload-media', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  getUnreadCounts: (userId: string) =>
    apiClient
      .get<{ success: boolean; counts: Array<{ postId: string; unread: number }> }>(
        `/api/v1/chat/unread-counts/${userId}`
      )
      .then((r) => r.data),
};
