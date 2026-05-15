import { apiClient } from '../client';
import type { ChatMessage } from '../../../shared/types/domain';

// Backend message shape: {sender, message, timestamp, readBy}
interface BackendMessage {
  _id?: string;
  sender: string;
  message: string;
  timestamp: string;
  readBy?: string[];
}

function mapToFrontendMessage(m: BackendMessage, roomId: string): ChatMessage {
  return {
    id: m._id ?? `${m.sender}-${m.timestamp}`,
    roomId,
    senderId: m.sender,
    text: m.message,
    createdAt: m.timestamp,
    read: (m.readBy?.length ?? 0) > 0,
  };
}

export const chatApi = {
  getMessages: async (roomId: string) => {
    const response = await apiClient.get<{ success: boolean; messages: BackendMessage[] }>(
      `/api/v1/chat/${roomId}`
    );
    const messages = (response.data.messages ?? []).map((m) => mapToFrontendMessage(m, roomId));
    return { messages, total: messages.length };
  },

  sendMessage: (roomId: string, sender: string, text: string) =>
    apiClient
      .post(`/api/v1/chat/${roomId}`, { sender, message: text })
      .then((r) => r.data),

  getUnreadCounts: (userId: string) =>
    apiClient
      .get<{ success: boolean; counts: Array<{ postId: string; unread: number }> }>(
        `/api/v1/chat/unread-counts/${userId}`
      )
      .then((r) => r.data),
};
