import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../../core/theme';
import { useToast } from '../../../shared/state/toast/ToastContext';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppCard } from '../../../shared/components/ui/AppCard';
import { agentApi } from '../../../core/api/endpoints/agentApi';
import type { MainStackParamList } from '../../../app/navigation/types';

interface DocState { uri: string; name: string; type: string }

const pickImage = async (title: string): Promise<DocState | null> => {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (result.canceled || !result.assets[0]) return null;
    const asset = result.assets[0];
    const ext = asset.uri.split('.').pop() ?? 'jpg';
    return {
      uri: asset.uri,
      name: `${title.replace(/\s/g, '_').toLowerCase()}.${ext}`,
      type: asset.mimeType ?? `image/${ext}`,
    };
  } catch {
    return null;
  }
};

const Slot = ({ label, doc, onPick, disabled }: {
  label: string; doc: DocState | null; onPick: () => void; disabled?: boolean;
}): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={disabled ? undefined : onPick}
      style={({ pressed }) => [
        s.slot,
        { borderColor: doc ? '#CBEBD6' : '#C7D0E2', borderStyle: doc ? 'solid' : 'dashed', backgroundColor: doc ? theme.colors.card : '#F7F9FD', opacity: pressed ? 0.75 : 1 },
      ]}
    >
      {doc ? (
        <>
          <Image source={{ uri: doc.uri }} style={s.preview} resizeMode="cover" />
          <View style={s.overlay}>
            <AppText style={s.overlayLabel}>{label}</AppText>
            <AppText style={s.overlayChange}>{t('kyc_tapToChange')}</AppText>
          </View>
        </>
      ) : (
        <View style={s.empty}>
          <View style={s.camBox}><AppText style={{ fontSize: 22 }}>📷</AppText></View>
          <AppText style={[s.emptyLabel, { color: theme.colors.text }]}>{label}</AppText>
          <AppText style={[s.emptyHint, { color: theme.colors.mutedText }]}>{t('kyc_tapToUpload')}</AppText>
        </View>
      )}
    </Pressable>
  );
};

type Rt = RouteProp<MainStackParamList, 'WorkerKycReupload'>;

export const WorkerKycReuploadScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation();
  const toast = useToast();
  const navigation = useNavigation();
  const route = useRoute<Rt>();
  const { workerId, workerName, reason } = route.params;

  const [front, setFront] = useState<DocState | null>(null);
  const [back, setBack] = useState<DocState | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (): Promise<void> => {
    if (!front && !back) {
      toast.error(t('kyc_reupload_pickAtLeastOne'));
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      if (front) {
        formData.append('aadharFront', { uri: front.uri, name: front.name, type: front.type } as unknown as Blob);
      }
      if (back) {
        formData.append('aadharBack', { uri: back.uri, name: back.name, type: back.type } as unknown as Blob);
      }
      await agentApi.reuploadWorkerKyc(workerId, formData);
      toast.success(t('kyc_reupload_success'));
      navigation.goBack();
    } catch {
      toast.error(t('kyc_submissionFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor="#1037A4" />
      <ScreenHeader title={t('kyc_reupload_title')} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {!!workerName && (
          <AppText style={[s.worker, { color: theme.colors.text }]}>{workerName}</AppText>
        )}
        {!!reason && (
          <View style={s.reasonBox}>
            <AppText style={s.reasonLabel}>{t('kyc_rejectionReasonLabel')}</AppText>
            <AppText style={s.reasonText}>{reason}</AppText>
          </View>
        )}
        <AppCard style={s.card}>
          <AppText style={[s.cardTitle, { color: theme.colors.text }]}>{t('kyc_reupload_uploadTitle')}</AppText>
          <View style={s.docsRow}>
            <Slot
              label={t('kyc_idFront')}
              doc={front}
              onPick={() => void pickImage('id_front').then((d) => { if (d) setFront(d); })}
              disabled={submitting}
            />
            <Slot
              label={t('kyc_idBack')}
              doc={back}
              onPick={() => void pickImage('id_back').then((d) => { if (d) setBack(d); })}
              disabled={submitting}
            />
          </View>
        </AppCard>

        <TouchableOpacity
          onPress={() => void handleSubmit()}
          disabled={submitting}
          activeOpacity={0.85}
          style={[s.submitBtn, { backgroundColor: submitting ? '#64748b' : '#0f172a' }]}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <AppText style={s.submitTxt}>{t('kyc_reupload_submitBtn')}</AppText>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  content:    { padding: 16, gap: 14 },
  worker:     { fontSize: 16, fontWeight: '800' },
  reasonBox:  { padding: 12, borderRadius: 12, backgroundColor: '#fff1f2', borderWidth: 1, borderColor: '#fca5a5' },
  reasonLabel:{ fontSize: 11, fontWeight: '800', color: '#b91c1c', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 2 },
  reasonText: { fontSize: 13, lineHeight: 19, color: '#7f1d1d' },
  card:       { padding: 16 },
  cardTitle:  { fontSize: 15, fontWeight: '800', marginBottom: 12 },
  docsRow:    { flexDirection: 'row', gap: 12 },
  slot:       { flex: 1, height: 172, borderWidth: 2, borderRadius: 16, overflow: 'hidden' },
  preview:    { width: '100%', height: '100%' },
  overlay:    { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(37,99,235,0.85)', padding: 8, alignItems: 'center' },
  overlayLabel: { color: '#fff', fontSize: 11, fontWeight: '700' },
  overlayChange:{ color: 'rgba(255,255,255,0.75)', fontSize: 10 },
  empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, padding: 12 },
  camBox:     { width: 50, height: 50, borderRadius: 14, backgroundColor: '#EEF2FE', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyLabel: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  emptyHint:  { fontSize: 11 },
  submitBtn:  { height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  submitTxt:  { color: '#fff', fontSize: 16, fontWeight: '800' },
});
