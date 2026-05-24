import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { ChatRoomScreen } from '../../features/chat/screens/ChatRoomScreen';
import { useAuth } from '../../state/auth/AuthContext';

export const ChatNavigator = (): React.JSX.Element => {
  const { state } = useAuth();
  const navigation = useNavigation();
  const userId = state.session?.user.id ?? '';

  return (
    <ChatRoomScreen
      roomId={`support_${userId}`}
      roomName="Support"
      onBack={() => {
        if (navigation.canGoBack()) {
          navigation.goBack();
        } else {
          navigation.navigate('Main' as never);
        }
      }}
    />
  );
};
