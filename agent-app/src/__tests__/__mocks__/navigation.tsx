// @react-navigation/native mock — NavigationContainer just renders its children
// (we ignore the ref/theme since the stack is mocked too).
import React from 'react';

export const NavigationContainer = ({
  children,
}: {
  children: React.ReactNode;
}): React.ReactNode => children;

const colors = {
  primary: '#000',
  background: '#000',
  card: '#000',
  text: '#000',
  border: '#000',
  notification: '#000',
};

export const DefaultTheme = { dark: false, colors };
export const DarkTheme = { dark: true, colors };
