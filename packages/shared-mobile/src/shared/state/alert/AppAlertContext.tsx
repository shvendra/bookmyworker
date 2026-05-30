import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppAlertModal, type AlertButton, type AlertType, type AppAlertConfig } from '../../components/ui/AppAlertModal';

// ── Imperative handler registered by the provider ──────────────────────────────
let _handler: ((config: AppAlertConfig) => void) | null = null;

/**
 * Drop-in replacement for React Native's `Alert.alert()`.
 * Call from anywhere — no hook or component context needed.
 *
 *   showAlert('Required', 'Please select your worker type.');
 *   showAlert('Are you sure?', 'This action cannot be undone.', [
 *     { text: 'Cancel', style: 'cancel' },
 *     { text: 'Delete', style: 'destructive', onPress: handleDelete },
 *   ]);
 */
export function showAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
  options?: { cancelable?: boolean; type?: AlertType },
): void {
  if (_handler) {
    _handler({ title, message, buttons, cancelable: options?.cancelable, type: options?.type });
  }
}

// ── Context (optional hook-based access) ──────────────────────────────────────
interface AlertContextValue {
  showAlert: typeof showAlert;
}

const AlertContext = createContext<AlertContextValue | undefined>(undefined);

export const useAppAlert = (): AlertContextValue => {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error('useAppAlert must be used inside AppAlertProvider');
  return ctx;
};

// ── Provider ──────────────────────────────────────────────────────────────────
export const AppAlertProvider = ({ children }: React.PropsWithChildren): React.JSX.Element => {
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<AppAlertConfig | null>(null);
  const pendingConfig = useRef<AppAlertConfig | null>(null);

  const show = useCallback((cfg: AppAlertConfig): void => {
    pendingConfig.current = cfg;
    setConfig(cfg);
    setVisible(true);
  }, []);

  const dismiss = useCallback((): void => {
    setVisible(false);
  }, []);

  // Register / unregister the imperative handler
  useEffect(() => {
    _handler = show;
    return () => {
      _handler = null;
    };
  }, [show]);

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      <AppAlertModal visible={visible} config={config} onDismiss={dismiss} />
    </AlertContext.Provider>
  );
};
