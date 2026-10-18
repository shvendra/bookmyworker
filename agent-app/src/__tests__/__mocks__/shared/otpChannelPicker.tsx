// Test double for features/auth/components/OtpChannelPicker — same testIDs as the real component.
import React from 'react';
import { Pressable, Text, View } from 'react-native';

export const OtpChannelPicker = ({ channel, onChange, disabled }: { channel: string; onChange: (c: 'whatsapp' | 'sms') => void; disabled?: boolean }) => (
  <View testID="otp-channel-picker">
    {(['whatsapp', 'sms'] as const).map((c) => (
      <Pressable key={c} testID={`otp-channel-${c}`} disabled={disabled} onPress={() => onChange(c)} accessibilityState={{ selected: channel === c }}>
        <Text>{c}</Text>
      </Pressable>
    ))}
  </View>
);

export const OtpOtherChannelLink = ({ channel, onPress, disabled }: { channel: string; onPress: () => void; disabled?: boolean }) => (
  <Pressable testID="otp-other-channel" disabled={disabled} onPress={onPress}>
    <Text>{channel === 'sms' ? 'otpTryWhatsApp' : 'otpTrySms'}</Text>
  </Pressable>
);

export const OtpUnavailableNotice = () => (
  <View testID="otp-unavailable">
    <Text>otpUnavailable</Text>
  </View>
);
