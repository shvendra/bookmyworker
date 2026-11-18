import React, { useContext, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { AppText } from '../ui/AppText';

/**
 * Slim, non-blocking strip shown when the phone IS connected (Wi-Fi / mobile data) but our server could not be
 * reached for a while. The app stays usable underneath; the strip clears itself the moment a request succeeds.
 */
export const WeakConnectionBanner = ({ onRetry }: { onRetry: () => Promise<void> | void }): React.JSX.Element => {
  const insets = useContext(SafeAreaInsetsContext);
  const [busy, setBusy] = useState(false);
  return (
    <View pointerEvents="box-none" style={[s.wrap, { top: (insets?.top ?? 0) + 4 }]} testID="weak-connection-banner">
      <View style={s.pill}>
        <View style={s.dot} />
        <View style={s.textCol}>
          <AppText style={s.title}>Weak connection</AppText>
          <AppText style={s.sub}>Connected, but we can't reach the server. Retrying… try mobile data if this stays.</AppText>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Retry now"
          disabled={busy}
          onPress={() => { setBusy(true); void Promise.resolve(onRetry()).finally(() => setBusy(false)); }}
          style={s.btn}
        >
          {busy ? <ActivityIndicator size="small" color="#fff" /> : <AppText style={s.btnTxt}>Retry</AppText>}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: 10, right: 10, zIndex: 9000, elevation: 9000 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 14, backgroundColor: '#92400E', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FCD34D' },
  textCol: { flex: 1 },
  title: { color: '#fff', fontSize: 12.5, fontWeight: '800', lineHeight: 17 },
  sub: { color: 'rgba(255,255,255,0.85)', fontSize: 11, lineHeight: 15 },
  btn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.18)', minWidth: 56, alignItems: 'center' },
  btnTxt: { color: '#fff', fontSize: 12, fontWeight: '800' },
});
