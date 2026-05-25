import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useAppTheme } from '../../../core/theme';
import { AppText } from '../../../shared/components/ui/AppText';
import type { MainStackParamList } from '../../../app/navigation/types';

type RouteT = RouteProp<MainStackParamList, 'PdfViewer'>;

export const PdfViewerScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteT>();
  const { url, title = 'Document' } = route.params;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Use Google Docs Viewer to render the PDF inside a WebView
  const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 10,
            backgroundColor: '#1037A4',
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <AppText style={styles.backIcon}>←</AppText>
        </TouchableOpacity>
        <AppText style={styles.headerTitle} numberOfLines={1}>{title}</AppText>
        <View style={styles.backBtn} />
      </View>

      {/* WebView */}
      <WebView
        source={{ uri: viewerUrl }}
        style={styles.webview}
        onLoadStart={() => { setLoading(true); setError(false); }}
        onLoadEnd={() => setLoading(false)}
        onError={() => { setLoading(false); setError(true); }}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState={false}
        scalesPageToFit
      />

      {/* Loading overlay */}
      {loading && !error && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#1037A4" />
            <AppText style={styles.loadingTxt}>Loading document…</AppText>
          </View>
        </View>
      )}

      {/* Error state */}
      {error && (
        <View style={styles.errorOverlay}>
          <AppText style={styles.errorEmoji}>📄</AppText>
          <AppText style={styles.errorTitle}>Could not load document</AppText>
          <AppText style={styles.errorSub}>Please check your internet connection and try again.</AppText>
          <TouchableOpacity
            onPress={() => { setError(false); setLoading(true); }}
            style={styles.retryBtn}
          >
            <AppText style={styles.retryTxt}>Retry</AppText>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', lineHeight: 22 },
  headerTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },

  webview: { flex: 1 },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingBox: { alignItems: 'center', gap: 12 },
  loadingTxt: { fontSize: 14, fontWeight: '600', color: '#475569' },

  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 10,
  },
  errorEmoji: { fontSize: 48, lineHeight: 56 },
  errorTitle: { fontSize: 16, fontWeight: '800', color: '#1e293b', textAlign: 'center' },
  errorSub: { fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 18 },
  retryBtn: {
    marginTop: 8,
    backgroundColor: '#1037A4',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryTxt: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
