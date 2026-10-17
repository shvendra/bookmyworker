import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import type { BgcPickedFile } from '../../core/api/endpoints/bgcApi';

/** Gallery photo (Android 13+ uses the system Photo Picker — no storage permission needed). */
export async function pickFromGallery(): Promise<BgcPickedFile | null> {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
  if (r.canceled || !r.assets?.[0]) return null;
  const a = r.assets[0]!;
  const mimeType = a.mimeType ?? (a.uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
  return { uri: a.uri, name: a.fileName ?? `photo_${Date.now()}.${mimeType === 'image/png' ? 'png' : 'jpg'}`, mimeType, size: a.fileSize ?? 0 };
}

/** A PDF / image from the phone's files. */
export async function pickFromFiles(): Promise<BgcPickedFile | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png'], copyToCacheDirectory: true });
  if (r.canceled || !r.assets?.[0]) return null;
  const a = r.assets[0]!;
  return { uri: a.uri, name: a.name, mimeType: a.mimeType ?? 'application/pdf', size: a.size ?? 0 };
}
