import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../core/theme';
import { Skeleton } from './Skeleton';

/** Card-shaped placeholder rows shown while a list loads (instead of a lone spinner). */
export const ListSkeleton = ({ rows = 4 }: { rows?: number }): React.JSX.Element => {
  const { theme } = useAppTheme();
  return (
    <View style={s.wrap} accessibilityLabel="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={[s.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Skeleton width={44} height={44} borderRadius={22} />
          <View style={s.lines}>
            <Skeleton width="60%" height={13} borderRadius={6} />
            <Skeleton width="85%" height={10} borderRadius={5} style={{ marginTop: 8 }} />
            <Skeleton width="40%" height={10} borderRadius={5} style={{ marginTop: 6 }} />
          </View>
        </View>
      ))}
    </View>
  );
};

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 14, gap: 10 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 14 },
  lines: { flex: 1 },
});
