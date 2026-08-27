import React, { useState } from 'react';
import { Modal, Pressable, View, StyleSheet, Dimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../../core/theme';
import { AppText } from './AppText';
import { AppInput } from './AppInput';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = Math.min(SCREEN_W - 48, 360);

/**
 * Shown right before payment — only for Industry/Agency employers whose
 * profile has no GST number on file — so it can be collected once at
 * checkout and printed on the invoice (buildInvoicePdfBuffer on the backend
 * already falls back to this when profile KYC has no GST). Always
 * skippable: GST is optional info, never a blocker to completing payment.
 */
interface GstPromptModalProps {
  visible: boolean;
  loading?: boolean;
  onClose: () => void;
  onContinue: (gstNumber: string | null) => void;
}

export const GstPromptModal = ({ visible, loading = false, onClose, onContinue }: GstPromptModalProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const isDark = theme.mode === 'dark';
  const { t } = useTranslation('employer');
  const [gst, setGst] = useState('');

  const finish = (value: string | null): void => {
    onContinue(value);
    setGst('');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={loading ? undefined : onClose}>
      <Pressable style={styles.backdrop} onPress={loading ? undefined : onClose}>
        <Pressable onPress={() => {/* swallow tap */}}>
          <View style={[styles.card, { width: CARD_W, backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }, isDark && styles.cardDark]}>
            <AppText style={[styles.title, { color: isDark ? '#F1F5F9' : '#0F172A' }]}>
              {t('wp_gstPromptTitle')}
            </AppText>
            <AppText style={[styles.body, { color: isDark ? '#94A3B8' : '#475569' }]}>
              {t('wp_gstPromptBody')}
            </AppText>
            <AppInput
              label={t('wp_gstLabel')}
              value={gst}
              onChangeText={(v) => setGst(v.toUpperCase())}
              placeholder="e.g. 23AAAAA0000A1Z5"
              maxLength={15}
              autoCapitalize="characters"
              autoFocus
            />
            <View style={styles.actions}>
              <Pressable
                style={[styles.btn, styles.btnSkip, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#F1F5F9' }]}
                onPress={() => finish(null)}
                disabled={loading}
              >
                <AppText style={[styles.btnSkipText, { color: isDark ? '#CBD5E1' : '#475569' }]}>{t('wp_gstSkip')}</AppText>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.btnContinue]}
                onPress={() => finish(gst.trim() || null)}
                disabled={loading}
              >
                <AppText style={styles.btnContinueText}>{t('wp_gstContinue')}</AppText>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(7,14,30,0.65)',
  },
  card: {
    borderRadius: 20,
    padding: 22,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.24,
    shadowRadius: 24,
    elevation: 16,
  },
  cardDark: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
  },
  body: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: -4,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  btn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSkip: {},
  btnSkipText: {
    fontSize: 14,
    fontWeight: '700',
  },
  btnContinue: {
    backgroundColor: '#1A56DB',
  },
  btnContinueText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
