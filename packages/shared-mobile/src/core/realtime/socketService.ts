import { io, type Socket } from 'socket.io-client';
import { ENV } from '../config/env';
import type { ChatMessage } from '../../shared/types/domain';

class SocketService {
  private socket: Socket | null = null;

  connect(accessToken: string): Socket {
    if (this.socket?.connected) {
      return this.socket;
    }

    this.socket = io(ENV.SOCKET_BASE_URL, {
      transports: ['websocket'],
      auth: {
        token: accessToken,
      },
    });

    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  joinRoom(roomId: string): void {
    this.socket?.emit('join_room', { roomId });
  }

  leaveRoom(roomId: string): void {
    this.socket?.emit('leave_room', { roomId });
  }

  sendMessage(roomId: string, sender: string, text: string): void {
    this.socket?.emit('send_message', { roomId, sender, message: text });
  }

  onMessage(callback: (message: ChatMessage) => void): void {
    this.socket?.on('receive_message', callback);
  }

  offMessage(callback: (message: ChatMessage) => void): void {
    this.socket?.off('receive_message', callback);
  }
}

export const socketService = new SocketService();
