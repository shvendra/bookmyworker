declare module 'react-native' {
  export const Platform: { OS: string; select: (obj: Record<string, unknown>) => unknown };
  export const Alert: { alert: (...args: unknown[]) => void };
  export const Linking: { openURL: (url: string) => Promise<void> };
  export const Dimensions: { get: (dim: string) => { width: number; height: number } };
  export const StyleSheet: {
    create: <T extends object>(styles: T) => T;
    hairlineWidth: number;
    absoluteFillObject: object;
  };
  export const View: string;
  export const Text: string;
  export const Image: string;
  export const TextInput: string;
  export const ScrollView: string;
  export const TouchableOpacity: string;
  export const Modal: string;
  export const ActivityIndicator: string;
  export const KeyboardAvoidingView: string;
  export const FlatList: string;
  export const Pressable: string;
  export const RefreshControl: string;
  export const StatusBar: string;
  export const SafeAreaView: string;
}
