import { io, type Socket } from 'socket.io-client';
import { ENV } from '../config/env';
import type { ChatMessage } from '../../shared/types/domain';

interface MediaPayload {
  mediaUrl: string;
  mediaType: 'image' | 'file';
  fileName: string;
}

class SocketService {
  private socket: Socket | null = null;
  private currentRoom: string | null = null;
  private reconnectHandler: (() => void) | null = null;

  connect(accessToken: string): Socket {
    if (this.socket?.connected) {
      return this.socket;
    }
    // Disconnect stale socket before reconnecting
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.socket = io(ENV.SOCKET_BASE_URL, {
      path: '/app/socket.io',
      transports: ['websocket', 'polling'],
      auth: { token: accessToken },
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 2000,
    });

    // Re-join current room after reconnect
    this.reconnectHandler = () => {
      if (this.currentRoom) {
        this.socket?.emit('join_room', this.currentRoom);
      }
    };
    this.socket.on('connect', this.reconnectHandler);

    return this.socket;
  }

  disconnect(): void {
    if (this.reconnectHandler && this.socket) {
      this.socket.off('connect', this.reconnectHandler);
    }
    this.socket?.disconnect();
    this.socket = null;
    this.currentRoom = null;
    this.reconnectHandler = null;
  }

  joinRoom(roomId: string): void {
    this.currentRoom = roomId;
    // Emit as plain string — backend expects: socket.on("join_room", (roomId) => ...)
    this.socket?.emit('join_room', roomId);
  }

  leaveRoom(_roomId: string): void {
    this.currentRoom = null;
    // Backend doesn't handle leave_room — just clear the stored room
  }

  sendMessage(roomId: string, sender: string, text: string, media?: MediaPayload): void {
    // Backend expects field name "room" not "roomId"
    this.socket?.emit('send_message', {
      room: roomId,
      sender,
      message: text,
      ...(media ?? {}),
    });
  }

  markMessagesRead(roomId: string, userId: string): void {
    this.socket?.emit('mark_messages_read', { roomId, userId });
  }

  onMessage(callback: (message: ChatMessage) => void): void {
    this.socket?.on('receive_message', callback);
  }

  offMessage(callback: (message: ChatMessage) => void): void {
    this.socket?.off('receive_message', callback);
  }

  onNewMessage(callback: (data: { sender: string; roomId: string }) => void): void {
    this.socket?.on('new_message', callback);
  }

  offNewMessage(callback: (data: { sender: string; roomId: string }) => void): void {
    this.socket?.off('new_message', callback);
  }
}

export const socketService = new SocketService();
