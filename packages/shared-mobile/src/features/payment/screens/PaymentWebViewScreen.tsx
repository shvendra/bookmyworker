import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView, type WebViewNavigation, type ShouldStartLoadRequest, type WebViewErrorEvent } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppText } from '../../../shared/components/ui/AppText';
import { useAuth } from '../../../state/auth/AuthContext';
import { queryClient } from '../../../core/query/queryClient';
import type { MainStackParamList } from '../../../app/navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;
type RouteT = RouteProp<MainStackParamList, 'PaymentWebView'>;

// URL patterns that indicate PhonePe has finished and redirected back to our backend
const CALLBACK_PATTERNS = [
  '/payment/callback',
  'payment/callback',
];

function parseCallbackParams(url: string): { status: string; amount: string; merchantOrderId: string } {
  try {
    const parsed = new URL(url);
    return {
      status: parsed.searchParams.get('status') ?? '',
      amount: parsed.searchParams.get('amount') ?? '',
      merchantOrderId: parsed.searchParams.get('merchantOrderId') ?? '',
    };
  } catch {
    return { status: '', amount: '', merchantOrderId: '' };
  }
}

export const PaymentWebViewScreen = (): React.JSX.Element => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteT>();
  const { url, merchantOrderId } = route.params;
  const insets = useSafeAreaInsets();
  const { updateProfile, state: authState } = useAuth();
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const resolved = useRef(false);
  const webViewRef = useRef<WebView>(null);

  const handleDone = (status: string, amount: string): void => {
    if (resolved.current) return;
    resolved.current = true;

    if (status === 'completed') {
      // Refresh auth session + invalidate dashboard query cache so subscription
      // status / remainingContacts reflect immediately when user navigates back
      void (async () => {
        try {
          const { getCurrentUser } = await import('../../../core/api/endpoints/authApi');
          const freshUser = await getCurrentUser();
          await updateProfile(freshUser);
        } catch { /* non-fatal */ }
        // Force all profile-dependent queries to refetch on next focus
        void queryClient.invalidateQueries({ queryKey: ['employer-full-profile'] });
        void queryClient.invalidateQueries({ queryKey: ['search-user-profile'] });
        void queryClient.invalidateQueries({ queryKey: ['subscription-screen-profile'] });
      })();

      Alert.alert(
        'Payment Successful! 🎉',
        `Your subscription has been activated.${amount ? `\nAmount paid: ₹${amount}` : ''}`,
        [{ text: 'Great!', onPress: () => { if (navigation.canGoBack()) navigation.goBack(); } }],
        { cancelable: false },
      );
    } else if (status === 'failed') {
      Alert.alert(
        'Payment Failed',
        'Your payment could not be processed. Please try again.',
        [{ text: 'OK', onPress: () => { if (navigation.canGoBack()) navigation.goBack(); } }],
        { cancelable: false },
      );
    } else {
      // pending or unknown — just go back
      Alert.alert(
        'Payment Pending',
        'Your payment is being processed. You will be notified once confirmed.',
        [{ text: 'OK', onPress: () => { if (navigation.canGoBack()) navigation.goBack(); } }],
        { cancelable: false },
      );
    }
  };

  const onNavigationStateChange = (navState: WebViewNavigation): void => {
    const currentUrl = navState.url ?? '';
    if (CALLBACK_PATTERNS.some((p) => currentUrl.includes(p))) {
      const { status, amount } = parseCallbackParams(currentUrl);
      handleDone(status, amount);
    }
  };

  return (
    <View style={[s.root, { backgroundColor: '#0f172a' }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          onPress={() => {
            Alert.alert(
              'Cancel Payment?',
              'Are you sure you want to cancel this payment?',
              [
                { text: 'No, Continue', style: 'cancel' },
                { text: 'Yes, Cancel', style: 'destructive', onPress: () => navigation.goBack() },
              ],
            );
          }}
          style={s.closeBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <AppText style={s.closeIcon}>✕</AppText>
        </TouchableOpacity>
        <AppText style={s.headerTitle}>Secure Payment</AppText>
        <View style={s.lockBadge}>
          <AppText style={s.lockText}>🔒 PhonePe</AppText>
        </View>
      </View>

      {/* Progress bar */}
      {loading && (
        <View style={s.progressTrack}>
          <View style={[s.progressBar, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
      )}

      <WebView
        ref={webViewRef}
        source={{ uri: url }}
        style={s.webview}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onLoadProgress={({ nativeEvent }: { nativeEvent: { progress: number } }) => setProgress(nativeEvent.progress)}
        onNavigationStateChange={onNavigationStateChange}
        originWhitelist={['*']}
        mixedContentMode="always"
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        cacheEnabled={false}
        userAgent="Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36"
        // Intercept non-http schemes before WebView tries to navigate (works on iOS;
        // on Android this runs async so onError below is the reliable fallback)
        onShouldStartLoadWithRequest={(req: ShouldStartLoadRequest) => {
          const { url: reqUrl } = req;
          if (!reqUrl.startsWith('http://') && !reqUrl.startsWith('https://')) {
            void Linking.openURL(reqUrl).catch(() => {
              Alert.alert('App Not Installed', 'The UPI app is not installed on this device. Please use another payment method.');
            });
            return false;
          }
          return true;
        }}
        // Android fallback: if the scheme error page shows, open via Linking then restore
        onError={({ nativeEvent }: WebViewErrorEvent) => {
          if (nativeEvent.code === -10 && nativeEvent.url) {
            void Linking.openURL(nativeEvent.url).catch(() => {
              Alert.alert('App Not Installed', 'The UPI app is not installed on this device. Please use another payment method.');
            });
            webViewRef.current?.goBack();
          }
        }}
        renderLoading={() => (
          <View style={s.loaderOverlay}>
            <ActivityIndicator size="large" color="#2563eb" />
            <AppText style={s.loaderText}>Loading Payment Gateway…</AppText>
          </View>
        )}
        startInLoadingState
        setSupportMultipleWindows={false}
        androidLayerType={Platform.OS === 'android' ? 'hardware' : undefined}
      />
    </View>
  );
};

// ─── TopupWebViewScreen (reuses same UI, different route) ─────────────────────
type TopupRoute = RouteProp<MainStackParamList, 'TopupWebView'>;

export const TopupWebViewScreen = (): React.JSX.Element => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<TopupRoute>();
  const { url } = route.params;
  const insets = useSafeAreaInsets();
  const { updateProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const resolved = useRef(false);
  const webViewRef = useRef<WebView>(null);

  const handleDone = (status: string, amount: string): void => {
    if (resolved.current) return;
    resolved.current = true;

    if (status === 'completed') {
      void (async () => {
        try {
          const { getCurrentUser } = await import('../../../core/api/endpoints/authApi');
          const freshUser = await getCurrentUser();
          await updateProfile(freshUser);
        } catch { /* non-fatal */ }
        void queryClient.invalidateQueries({ queryKey: ['employer-full-profile'] });
        void queryClient.invalidateQueries({ queryKey: ['search-user-profile'] });
        void queryClient.invalidateQueries({ queryKey: ['subscription-screen-profile'] });
      })();
      Alert.alert(
        'Top-up Successful! 🎉',
        `Contacts added to your account.${amount ? `\nAmount paid: ₹${amount}` : ''}`,
        [{ text: 'Great!', onPress: () => { if (navigation.canGoBack()) navigation.goBack(); } }],
        { cancelable: false },
      );
    } else if (status === 'failed') {
      Alert.alert('Payment Failed', 'Please try again.', [{ text: 'OK', onPress: () => navigation.goBack() }], { cancelable: false });
    } else {
      Alert.alert('Payment Pending', 'You will be notified once confirmed.', [{ text: 'OK', onPress: () => navigation.goBack() }], { cancelable: false });
    }
  };

  const onNavigationStateChange = (navState: WebViewNavigation): void => {
    const currentUrl = navState.url ?? '';
    if (CALLBACK_PATTERNS.some((p) => currentUrl.includes(p))) {
      const { status, amount } = parseCallbackParams(currentUrl);
      handleDone(status, amount);
    }
  };

  return (
    <View style={[s.root, { backgroundColor: '#0f172a' }]}>
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          onPress={() => Alert.alert('Cancel Payment?', 'Are you sure?', [
            { text: 'No, Continue', style: 'cancel' },
            { text: 'Yes, Cancel', style: 'destructive', onPress: () => navigation.goBack() },
          ])}
          style={s.closeBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <AppText style={s.closeIcon}>✕</AppText>
        </TouchableOpacity>
        <AppText style={s.headerTitle}>Contact Top-up</AppText>
        <View style={s.lockBadge}>
          <AppText style={s.lockText}>🔒 PhonePe</AppText>
        </View>
      </View>

      {loading && (
        <View style={s.progressTrack}>
          <View style={[s.progressBar, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
      )}

      <WebView
        ref={webViewRef}
        source={{ uri: url }}
        style={s.webview}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onLoadProgress={({ nativeEvent }: { nativeEvent: { progress: number } }) => setProgress(nativeEvent.progress)}
        onNavigationStateChange={onNavigationStateChange}
        originWhitelist={['*']}
        mixedContentMode="always"
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        cacheEnabled={false}
        userAgent="Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36"
        onShouldStartLoadWithRequest={(req: ShouldStartLoadRequest) => {
          const { url: reqUrl } = req;
          if (!reqUrl.startsWith('http://') && !reqUrl.startsWith('https://')) {
            void Linking.openURL(reqUrl).catch(() => {
              Alert.alert('App Not Installed', 'The UPI app is not installed on this device. Please use another payment method.');
            });
            return false;
          }
          return true;
        }}
        onError={({ nativeEvent }: WebViewErrorEvent) => {
          if (nativeEvent.code === -10 && nativeEvent.url) {
            void Linking.openURL(nativeEvent.url).catch(() => {
              Alert.alert('App Not Installed', 'The UPI app is not installed on this device. Please use another payment method.');
            });
            webViewRef.current?.goBack();
          }
        }}
        renderLoading={() => (
          <View style={s.loaderOverlay}>
            <ActivityIndicator size="large" color="#2563eb" />
            <AppText style={s.loaderText}>Loading Payment Gateway…</AppText>
          </View>
        )}
        startInLoadingState
        setSupportMultipleWindows={false}
        androidLayerType={Platform.OS === 'android' ? 'hardware' : undefined}
      />
    </View>
  );
};

const s = StyleSheet.create({
  root:         { flex: 1 },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#0f172a', gap: 12 },
  closeBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  closeIcon:    { color: '#fff', fontSize: 14, fontWeight: '700' },
  headerTitle:  { flex: 1, fontSize: 16, fontWeight: '800', color: '#fff' },
  lockBadge:    { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  lockText:     { fontSize: 12, fontWeight: '700', color: '#fff' },
  progressTrack:{ height: 3, backgroundColor: 'rgba(255,255,255,0.1)' },
  progressBar:  { height: 3, backgroundColor: '#2563eb' },
  webview:      { flex: 1 },
  loaderOverlay:{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', gap: 14 },
  loaderText:   { fontSize: 13, color: '#64748b', fontWeight: '500' },
});
