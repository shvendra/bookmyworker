import React, { useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../../core/theme';
import { AppText } from '../ui/AppText';
import { requirementsApi } from '../../../core/api/endpoints/requirementsApi';
import { useToast } from '../../state/toast/ToastContext';

const MAX_PHOTOS = 10;

interface ProjectMediaPickerProps {
  requirementId: string;
  initialPhotos?: string[];
  initialVideoUrl?: string;
}

// Multi-photo grid (up to 10, add/remove) + a single video (add/remove) for a
// Project listing. Every action hits /api/v1/project-media/* immediately
// (ownership-checked server-side against requirementId) — there's no separate
// "save" step, each add/remove is already persisted.
export const ProjectMediaPicker = ({ requirementId, initialPhotos = [], initialVideoUrl = '' }: ProjectMediaPickerProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const toast = useToast();
  const { t } = useTranslation();
  const [photos, setPhotos] = useState<string[]>(initialPhotos);
  const [videoUrl, setVideoUrl] = useState<string>(initialVideoUrl);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  const videoPlayer = useVideoPlayer(videoUrl || null, (player) => { player.loop = false; });

  const pickAndUploadPhoto = async (): Promise<void> => {
    if (photos.length >= MAX_PHOTOS) {
      toast.error(t('pl_maxPhotosToast', { max: MAX_PHOTOS }));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const ext = asset.uri.split('.').pop() ?? 'jpg';
    setUploadingPhoto(true);
    try {
      const { photos: updated } = await requirementsApi.uploadProjectPhoto(
        requirementId, asset.uri, `photo.${ext}`, asset.mimeType ?? `image/${ext}`,
      );
      setPhotos(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('pl_photoUploadFail'));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const deletePhoto = async (photoUrl: string): Promise<void> => {
    const prev = photos;
    setPhotos(photos.filter((p) => p !== photoUrl));
    try {
      await requirementsApi.deleteProjectPhoto(requirementId, photoUrl);
    } catch (err) {
      setPhotos(prev);
      toast.error(err instanceof Error ? err.message : t('pl_photoRemoveFail'));
    }
  };

  const pickAndUploadVideo = async (): Promise<void> => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 0.8,
      videoMaxDuration: 120,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const ext = asset.uri.split('.').pop() ?? 'mp4';
    setUploadingVideo(true);
    try {
      const url = await requirementsApi.uploadProjectVideo(
        requirementId, asset.uri, `video.${ext}`, asset.mimeType ?? `video/${ext}`,
      );
      setVideoUrl(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('pl_videoUploadFail'));
    } finally {
      setUploadingVideo(false);
    }
  };

  const deleteVideo = async (): Promise<void> => {
    const prev = videoUrl;
    setVideoUrl('');
    try {
      await requirementsApi.deleteProjectVideo(requirementId);
    } catch (err) {
      setVideoUrl(prev);
      toast.error(err instanceof Error ? err.message : t('pl_videoRemoveFail'));
    }
  };

  return (
    <View>
      <AppText style={[styles.label, { color: theme.colors.mutedText }]}>
        {t('pl_photosLabel', { count: photos.length, max: MAX_PHOTOS })}
      </AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
        {photos.map((url) => (
          <View key={url} style={[styles.photoTile, { borderColor: theme.colors.border }]}>
            <Image source={{ uri: url }} style={styles.photoImg} />
            <TouchableOpacity style={styles.removeBadge} onPress={() => deletePhoto(url)} activeOpacity={0.8}>
              <Ionicons name="close" size={13} color="#fff" />
            </TouchableOpacity>
          </View>
        ))}
        {photos.length < MAX_PHOTOS && (
          <TouchableOpacity
            style={[styles.photoTile, styles.addTile, { borderColor: theme.colors.border }]}
            onPress={pickAndUploadPhoto}
            disabled={uploadingPhoto}
            activeOpacity={0.75}
          >
            {uploadingPhoto ? (
              <ActivityIndicator color={theme.colors.primary} />
            ) : (
              <>
                <Ionicons name="add" size={22} color={theme.colors.mutedText} />
                <AppText style={[styles.addTileLabel, { color: theme.colors.mutedText }]}>{t('pl_addPhoto')}</AppText>
              </>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>

      <AppText style={[styles.label, { color: theme.colors.mutedText, marginTop: 16 }]}>{t('pl_videoLabel')}</AppText>
      {videoUrl ? (
        <View style={[styles.videoWrap, { borderColor: theme.colors.border }]}>
          <VideoView player={videoPlayer} style={styles.video} contentFit="cover" nativeControls />
          <TouchableOpacity style={styles.removeBadge} onPress={deleteVideo} activeOpacity={0.8}>
            <Ionicons name="close" size={14} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.videoAddBtn, { borderColor: theme.colors.border }]}
          onPress={pickAndUploadVideo}
          disabled={uploadingVideo}
          activeOpacity={0.75}
        >
          {uploadingVideo ? (
            <ActivityIndicator color={theme.colors.primary} />
          ) : (
            <>
              <Ionicons name="videocam-outline" size={18} color={theme.colors.text} />
              <AppText style={{ color: theme.colors.text, fontWeight: '700', marginLeft: 6 }}>{t('pl_addVideo')}</AppText>
            </>
          )}
        </TouchableOpacity>
      )}
      <AppText style={[styles.hint, { color: theme.colors.mutedText }]}>
        {t('pl_mediaHint')}
      </AppText>
    </View>
  );
};

const styles = StyleSheet.create({
  label: { fontSize: 12.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 },
  photoRow: { flexGrow: 0 },
  photoTile: { width: 92, height: 92, borderRadius: 10, borderWidth: 1, marginRight: 10, overflow: 'hidden', position: 'relative' },
  photoImg: { width: '100%', height: '100%' },
  addTile: { borderStyle: 'dashed', borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  addTileLabel: { fontSize: 10, fontWeight: '700', marginTop: 4 },
  removeBadge: {
    position: 'absolute', top: 3, right: 3, width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
  },
  videoWrap: { width: 200, height: 140, borderRadius: 10, borderWidth: 1, overflow: 'hidden', position: 'relative' },
  video: { width: '100%', height: '100%' },
  videoAddBtn: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1,
  },
  hint: { fontSize: 10.5, marginTop: 10 },
});
