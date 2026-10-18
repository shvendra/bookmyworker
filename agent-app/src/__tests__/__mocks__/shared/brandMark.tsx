// Test double for shared/components/ui/BrandMark — same structure/testIDs (monogram "B" + an Image layer).
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

export const BrandMark = ({ style }: { style?: unknown }) => {
  const flat = StyleSheet.flatten(style as never) as { width?: number } | undefined;
  const size = typeof flat?.width === 'number' ? flat.width : 56;
  return (
    <View style={{ width: size, height: size }} testID="brand-mark">
      <Text>B</Text>
      <Image source={{ uri: 'data:image/png;base64,TEST' }} />
    </View>
  );
};
