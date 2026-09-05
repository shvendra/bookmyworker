import React from 'react';
import { Modal, View, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { AppText } from './AppText';

// Festival wishes popup for the employer app, controlled by SuperAdmin
// (Settings → Festival Promotions). Purely presentational — the parent decides
// when `visible` is true (gated on promotions.festivalMode, shown once/session).
//
// Deliberately image-only — the banner itself carries the whole greeting/design,
// so there's no separate title/message to render.

interface Props {
  visible: boolean;
  festivalImageUrl: string;
  onClose: () => void;
}

export const FestivalWishesModal = ({
  visible,
  festivalImageUrl,
  onClose,
}: Props): React.JSX.Element => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <AppText style={styles.closeTxt}>✕</AppText>
          </TouchableOpacity>

          <Image source={{ uri: festivalImageUrl }} style={styles.image} resizeMode="contain" />
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
    backgroundColor: '#0f172a',
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
  closeTxt: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  image: { width: '100%', height: 420 },
});
