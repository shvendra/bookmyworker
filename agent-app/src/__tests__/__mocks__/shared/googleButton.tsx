// Test double for the shared GoogleButton: same labels/hint keys, minimal markup.
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

export const GoogleButton = ({ onPress, busy = false, disabled = false, hint }: { onPress: () => void; busy?: boolean; disabled?: boolean; hint?: string }) => (
  <View>
    <TouchableOpacity onPress={busy ? undefined : onPress} disabled={busy} accessibilityState={{ disabled: busy || disabled }}>
      <Text>{busy ? 'processing' : 'continueWithGoogle'}</Text>
    </TouchableOpacity>
    {!!hint && <Text>{hint}</Text>}
  </View>
);
