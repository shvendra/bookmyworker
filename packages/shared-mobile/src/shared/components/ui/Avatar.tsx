import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { AppText } from './AppText';

interface AvatarProps {
  name: string;
  uri?: string;
  size?: number;
  color?: string;
  /** Show a colored ring around the avatar */
  ring?: boolean;
  ringColor?: string;
  /** Show a small status indicator dot */
  online?: boolean;
}

const getInitials = (name: string): string => {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return (parts[0] ?? '').charAt(0).toUpperCase();
  return ((parts[0] ?? '').charAt(0) + (parts[parts.length - 1] ?? '').charAt(0)).toUpperCase();
};

// Premium gradient-like palette for avatars
const AVATAR_PALETTES: Array<{ bg: string; text: string }> = [
  { bg: '#1B4FD8', text: '#FFFFFF' },
  { bg: '#7C3AED', text: '#FFFFFF' },
  { bg: '#059669', text: '#FFFFFF' },
  { bg: '#D97706', text: '#FFFFFF' },
  { bg: '#DC2626', text: '#FFFFFF' },
  { bg: '#0284C7', text: '#FFFFFF' },
  { bg: '#DB2777', text: '#FFFFFF' },
  { bg: '#0D9488', text: '#FFFFFF' },
  { bg: '#EA580C', text: '#FFFFFF' },
  { bg: '#4F46E5', text: '#FFFFFF' },
  { bg: '#0F766E', text: '#FFFFFF' },
  { bg: '#B45309', text: '#FFFFFF' },
];

const nameToPalette = (name: string): { bg: string; text: string } => {
  if (!name || name.length === 0) return AVATAR_PALETTES[0]!;
  const idx = (name.charCodeAt(0) + (name.charCodeAt(1) ?? 0)) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[idx] ?? AVATAR_PALETTES[0]!;
};

export const Avatar = ({ name, uri, size = 40, color, ring = false, ringColor, online = false }: AvatarProps): React.JSX.Element => {
  const safeName = name || '?';
  const palette = nameToPalette(safeName);
  const bgColor = color ?? palette.bg;
  const textColor = palette.text;
  const fontSize = Math.round(size * 0.38);
  const ringWidth = ring ? 2 : 0;
  const outerSize = size + ringWidth * 2 + (ring ? 4 : 0);
  const dotSize = Math.round(size * 0.28);
  const dotMin = 8;
  const dotMax = 14;
  const resolvedDotSize = Math.min(dotMax, Math.max(dotMin, dotSize));

  const inner = uri ? (
    <Image
      source={{ uri }}
      style={[{ width: size, height: size, borderRadius: size / 2 }, styles.image]}
      contentFit="cover"
      cachePolicy="memory-disk"
      transition={150}
    />
  ) : (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bgColor,
        },
      ]}
    >
      <AppText
        variant="label"
        color={textColor}
        style={{ fontSize, lineHeight: size, fontWeight: '700', textAlign: 'center' }}
      >
        {getInitials(safeName)}
      </AppText>
    </View>
  );

  if (!ring && !online) return inner;

  return (
    <View style={{ width: outerSize, height: outerSize, alignItems: 'center', justifyContent: 'center' }}>
      {ring && (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: outerSize / 2,
              borderWidth: 2,
              borderColor: ringColor ?? '#1B4FD8',
            },
          ]}
        />
      )}
      {inner}
      {online && (
        <View
          style={[
            styles.onlineDot,
            {
              width: resolvedDotSize,
              height: resolvedDotSize,
              borderRadius: resolvedDotSize / 2,
              bottom: ring ? 2 : 0,
              right: ring ? 2 : 0,
            },
          ]}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    backgroundColor: '#E2E8F2',
  },
  onlineDot: {
    position: 'absolute',
    backgroundColor: '#059669',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});
