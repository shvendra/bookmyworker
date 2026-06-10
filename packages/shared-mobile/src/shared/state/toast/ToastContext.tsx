import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { View } from 'react-native';
import { Toast, type ToastType } from '../../components/feedback/Toast';

export interface ToastMessage {
  id: string;
  message: string;
  title?: string;
  type: ToastType;
  duration: number;
}

export interface ShowToastOptions {
  message: string;
  title?: string;
  type?: ToastType;
  /** Duration in ms before auto-dismiss. Default 3500. */
  duration?: number;
}

interface ToastContextValue {
  showToast: (options: ShowToastOptions) => void;
  /** Convenience helpers */
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let _nextId = 0;
const nextId = (): string => String(++_nextId);

export const ToastProvider = ({ children }: React.PropsWithChildren): React.JSX.Element => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string): void => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const t = timers.current.get(id);
    if (t) { clearTimeout(t); timers.current.delete(id); }
  }, []);

  const showToast = useCallback(
    ({ message, title, type = 'info', duration = 3500 }: ShowToastOptions): void => {
      const id = nextId();
      // Keep at most 3 toasts stacked
      setToasts((prev) => [...prev.slice(-2), { id, message, title, type, duration }]);
      const timer = setTimeout(() => dismiss(id), duration);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  const success = useCallback(
    (message: string, title?: string) => showToast({ message, title, type: 'success' }),
    [showToast],
  );
  const error = useCallback(
    (message: string, title?: string) => showToast({ message, title, type: 'error' }),
    [showToast],
  );
  const warning = useCallback(
    (message: string, title?: string) => showToast({ message, title, type: 'warning' }),
    [showToast],
  );
  const info = useCallback(
    (message: string, title?: string) => showToast({ message, title, type: 'info' }),
    [showToast],
  );

  const value = useMemo<ToastContextValue>(
    () => ({ showToast, success, error, warning, info }),
    [showToast, success, error, warning, info],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast overlay — renders above all navigation content because it is the
          LAST sibling (default Android paint order draws it on top). We must NOT
          set `zIndex` here: a zIndex on a root-level, full-screen overlay that
          persists across every screen transition makes the parent ReactViewGroup
          enable a custom child-drawing-order, which react-native-screens then
          replays mid-transition with a stale index → native crash
          `IndexOutOfBoundsException: getChildDrawingOrder() returned invalid index`. */}
      <View pointerEvents="box-none" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, top: 0 }}>
        {toasts.map((toast, index) => (
          <Toast
            key={toast.id}
            {...toast}
            onDismiss={() => dismiss(toast.id)}
            stackIndex={toasts.length - 1 - index}
          />
        ))}
      </View>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
};
