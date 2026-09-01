import React, { useEffect, useState } from 'react';
import { Linking, Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AppText } from '../../../shared/components/ui/AppText';
import { useAppTheme } from '../../../core/theme';
import type { CalledWorker } from '../hooks/useCallReturn';

interface Props {
  worker: CalledWorker | null;
  /** User confirms the call connected → parent opens the outcome picker. */
  onConnected: (w: CalledWorker) => void;
  onDismiss: () => void;
}

/**
 * Shown after the user returns from a phone call placed via the app.
 * Step 1: "Did the call connect?"  →  Yes = log outcome, No = offer WhatsApp.
 * Fully translated; falls back to English via i18n fallbackLng.
 */
export const CallCheckSheet = ({ worker, onConnected, onDismiss }: Props): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<'ask' | 'wa'>('ask');

  useEffect(() => {
    if (worker) setStep('ask');
  }, [worker]);

  const C = theme.colors;
  const name = worker?.name?.trim() || '';

  const sendWhatsApp = () => {
    if (worker?.phone) {
      const num = worker.phone.replace(/\D/g, '');
      void Linking.openURL(`https://wa.me/91${num.length > 10 ? num.slice(-10) : num}`);
    }
    onDismiss();
  };

  return (
    <Modal visible={!!worker} transparent animationType="slide" onRequestClose={onDismiss}>
      <TouchableOpacity activeOpacity={1} style={styles.scrim} onPress={onDismiss}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => {}}
          style={[
            styles.sheet,
            { backgroundColor: C.card, paddingBottom: insets.bottom + 18 },
          ]}
        >
          <View style={[styles.grip, { backgroundColor: C.border }]} />

          <View style={[styles.iconWrap, { backgroundColor: C.primaryLight }]}>
            <Ionicons
              name={step === 'ask' ? 'call' : 'logo-whatsapp'}
              size={22}
              color={step === 'ask' ? C.primary : '#25D366'}
            />
          </View>

          {step === 'ask' ? (
            <>
              <AppText style={[styles.title, { color: C.text }]}>{t('ws_callcheck_title')}</AppText>
              {!!name && (
                <AppText style={[styles.sub, { color: C.mutedText }]}>
                  {t('ws_callcheck_with', { name })}
                </AppText>
              )}

              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.btn, { backgroundColor: C.primary }]}
                onPress={() => worker && onConnected(worker)}
              >
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <AppText style={styles.btnTxt}>{t('ws_callcheck_yes')}</AppText>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.btnOutline, { borderColor: C.border }]}
                onPress={() => setStep('wa')}
              >
                <Ionicons name="close-circle" size={18} color={C.mutedText} />
                <AppText style={[styles.btnOutlineTxt, { color: C.text }]}>
                  {t('ws_callcheck_no')}
                </AppText>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <AppText style={[styles.title, { color: C.text }]}>{t('ws_callcheck_wa_title')}</AppText>
              <AppText style={[styles.sub, { color: C.mutedText }]}>{t('ws_callcheck_wa_sub')}</AppText>

              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.btn, { backgroundColor: '#25D366' }]}
                onPress={sendWhatsApp}
              >
                <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                <AppText style={styles.btnTxt}>{t('ws_callcheck_wa_btn')}</AppText>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.btnOutline, { borderColor: C.border }]}
                onPress={onDismiss}
              >
                <AppText style={[styles.btnOutlineTxt, { color: C.mutedText }]}>
                  {t('ws_callcheck_skip')}
                </AppText>
              </TouchableOpacity>
            </>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 10,
    alignItems: 'center',
  },
  grip: { width: 40, height: 4, borderRadius: 2, marginBottom: 16 },
  iconWrap: {
    width: 52, height: 52, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  title: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  sub: { fontSize: 13.5, textAlign: 'center', marginTop: 4, marginBottom: 18 },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    alignSelf: 'stretch', height: 50, borderRadius: 14, marginTop: 4,
  },
  btnTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
  btnOutline: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    alignSelf: 'stretch', height: 48, borderRadius: 14, borderWidth: 1.5, marginTop: 10,
  },
  btnOutlineTxt: { fontSize: 14.5, fontWeight: '700' },
});
