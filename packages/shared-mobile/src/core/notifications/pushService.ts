import { Platform } from 'react-native';
import Constants from 'expo-constants';

// expo-notifications Android push removed from Expo Go SDK 53+.
// Use dynamic import so the module never loads statically in Expo Go.
const isExpoGo = Constants.appOwnership === 'expo';

export const registerForPushNotifications = async (): Promise<string | null> => {
  if (isExpoGo) return null;
  try {
    const Device = await import('expo-device');
    const Notifications = await import('expo-notifications');

    if (!Device.isDevice) return null;

    await Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    // Native FCM (Android) / APNs (iOS) device token — sent directly to FCM
    // via firebase-admin on the backend, no Expo relay. Requires the app to be
    // built with google-services.json (Android) present.
    const token = await Notifications.getDevicePushTokenAsync();
    return typeof token.data === 'string' ? token.data : null;
  } catch (_) {
    return null;
  }
};
