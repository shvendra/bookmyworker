import React from 'react';
import { Modal, View, Image, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useAppTheme } from '../../../core/theme';
import { AppText } from './AppText';

// Festival wishes popup for the employer app, controlled by SuperAdmin
// (Settings → Festival Promotions). Purely presentational — the parent decides
// when `visible` is true (gated on promotions.festivalMode, shown once/session).
//
// festivalMessage is rich-text HTML authored in the CRM; RN can't render HTML
// without an extra dependency, so we strip tags to plain text for the greeting.
function htmlToText(html: string): string {
  return (html || '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*p\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

interface Props {
  visible: boolean;
  festivalName: string;
  festivalMessage: string;
  festivalImageUrl: string;
  onClose: () => void;
}

export const FestivalWishesModal = ({
  visible,
  festivalName,
  festivalMessage,
  festivalImageUrl,
  onClose,
}: Props): React.JSX.Element => {
  const { theme } = useAppTheme();
  const message = htmlToText(festivalMessage);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          {/* Close */}
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <AppText style={[styles.closeTxt, { color: theme.colors.mutedText }]}>✕</AppText>
          </TouchableOpacity>

          {festivalImageUrl ? (
            <Image source={{ uri: festivalImageUrl }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={styles.emojiHeader}>
              <AppText style={styles.emoji}>🎉</AppText>
            </View>
          )}

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {!!festivalName && (
              <AppText style={[styles.title, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {festivalName}
              </AppText>
            )}
            {!!message && (
              <AppText style={[styles.message, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                {message}
              </AppText>
            )}

            <TouchableOpacity onPress={onClose} style={[styles.btn, { backgroundColor: theme.colors.primary }]} activeOpacity={0.85}>
              <AppText style={styles.btnTxt}>Thank you 🙏</AppText>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    overflow: 'hidden',
    maxHeight: '85%',
  },
  closeBtn: {
    position: 'absolute',
    top: 10,
    right: 12,
    zIndex: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeTxt: { fontSize: 15, fontWeight: '700' },
  image: { width: '100%', height: 190 },
  emojiHeader: {
    height: 150,
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 56 },
  body: { paddingHorizontal: 22, paddingVertical: 22, alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '800', textAlign: 'center', letterSpacing: -0.3 },
  message: { fontSize: 15, lineHeight: 23, textAlign: 'center', marginTop: 10 },
  btn: {
    marginTop: 22,
    alignSelf: 'stretch',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
