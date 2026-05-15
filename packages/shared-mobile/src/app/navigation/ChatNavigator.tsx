import React, { useState } from 'react';
import { ChatListScreen } from '../../features/chat/screens/ChatListScreen';
import { ChatRoomScreen } from '../../features/chat/screens/ChatRoomScreen';
import { useAuth } from '../../state/auth/AuthContext';
import type { ChatRoom } from '../../shared/types/domain';

export const ChatNavigator = (): React.JSX.Element => {
  const { state } = useAuth();
  const userId = state.session?.user.id ?? '';
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);

  if (activeRoom) {
    const otherUserId = activeRoom.participants.find((p) => p !== userId) ?? '';
    const roomName = activeRoom.participantNames[otherUserId] ?? 'Chat';
    const roomAvatar = activeRoom.participantImages?.[otherUserId];
    return (
      <ChatRoomScreen
        roomId={activeRoom.id}
        roomName={roomName}
        roomAvatar={roomAvatar}
      />
    );
  }

  return <ChatListScreen onOpenRoom={setActiveRoom} />;
};
