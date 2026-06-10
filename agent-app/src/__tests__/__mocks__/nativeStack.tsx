// @react-navigation/native-stack mock. The Navigator renders all its Screen
// children; each Screen renders its `component`, or invokes its render-prop
// children (Main / ChatRoom) with a fake route so those branches are covered.
import React from 'react';

type ScreenProps = {
  component?: React.ComponentType<unknown>;
  children?: (props: { route: { params: Record<string, unknown> } }) => React.ReactNode;
};

export const createNativeStackNavigator = () => ({
  Navigator: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Screen: ({ component: Component, children }: ScreenProps) => {
    if (typeof children === 'function') {
      return children({
        route: { params: { roomId: 'r1', roomName: 'Room', roomAvatar: undefined } },
      });
    }
    return Component ? <Component /> : null;
  },
});

export type NativeStackScreenProps<
  _ParamList = unknown,
  _RouteName = unknown,
> = {
  navigation: Record<string, unknown>;
  route: { params?: Record<string, unknown> };
};
