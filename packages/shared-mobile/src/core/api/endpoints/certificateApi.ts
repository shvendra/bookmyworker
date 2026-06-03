import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { apiClient } from '../client';
import { getAccessToken } from '../../storage/authStorage';
import { ENV } from '../../config/env';
import type { Certificate } from '../../../shared/types/domain';

// FileSystem.uploadAsync doesn't work on Expo web — blob URIs aren't handled.
// On web we fetch the blob URI and use native fetch + FormData with a real File.
async function uploadMultipartWeb(
  endpointUrl: string,
  uri: string,
  fieldName: string,
  mimeType: string,
  token: string | null,
  extraParams: Record<string, string> = {}
): Promise<{ status: number; body: string }> {
  const blobResp = await fetch(uri);
  const blob = await blobResp.blob();
  const ext = uri.split('.').pop()?.split('?')[0] ?? mimeType.split('/')[1] ?? 'bin';
  const file = new File([blob], `upload.${ext}`, { type: mimeType });
  const formData = new FormData();
  formData.append(fieldName, file);
  for (const [k, v] of Object.entries(extraParams)) {
    formData.append(k, v);
  }
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const resp = await fetch(endpointUrl, { method: 'POST', headers, body: formData, credentials: 'include' });
  const body = await resp.text();
  return { status: resp.status, body };
}

export interface CertificatesResponse {
  certificates: Certificate[];
  labourLicenceUrl: string | null;
}

// FileSystem.uploadAsync / native fetch bypass the axios interceptor, so the
// response body may be a non-JSON gateway/error page (HTML 502, empty body).
// Parse defensively — never let a raw SyntaxError escape to the UI.
function safeParse<T>(rawBody: string): T | null {
  try {
    return JSON.parse(rawBody) as T;
  } catch {
    return null;
  }
}

export const certificateApi = {
  /** Fetch current user's certificates and labour licence URL */
  getAll: (): Promise<CertificatesResponse> =>
    apiClient
      .get<{ success: boolean; certificates: Certificate[]; labourLicenceUrl: string | null }>(
        '/api/v1/user/certificates'
      )
      .then((r) => ({
        certificates: r.data.certificates ?? [],
        labourLicenceUrl: r.data.labourLicenceUrl ?? null,
      })),

  /** Upload a skill certificate (workers). Field name: "certificate". */
  uploadCertificate: async (
    uri: string,
    filename: string,
    mimeType: string,
    certName: string
  ): Promise<Certificate> => {
    const token = await getAccessToken();
    const endpointUrl = `${ENV.API_BASE_URL}/api/v1/user/upload-certificate`;
    let status: number;
    let rawBody: string;
    if (Platform.OS === 'web') {
      const r = await uploadMultipartWeb(endpointUrl, uri, 'certificate', mimeType, token, { certName });
      status = r.status; rawBody = r.body;
    } else {
      const r = await FileSystem.uploadAsync(endpointUrl, uri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'certificate',
        mimeType,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        parameters: { certName },
      });
      status = r.status; rawBody = r.body;
    }
    if (status >= 400) {
      const parsed = safeParse<{ message?: string }>(rawBody);
      throw new Error(parsed?.message ?? `Upload failed (${status})`);
    }
    const json = safeParse<{ success: boolean; certificate: Certificate; message?: string }>(rawBody);
    if (!json?.success) throw new Error(json?.message ?? 'Upload failed');
    return json.certificate;
  },

  /** Delete a certificate by its index in the array */
  deleteCertificate: (index: number): Promise<Certificate[]> =>
    apiClient
      .delete<{ success: boolean; certificates: Certificate[] }>(
        `/api/v1/user/certificate/${index}`
      )
      .then((r) => r.data.certificates ?? []),

  /** Upload labour licence (agents). Field name: "licence". Replaces existing. */
  uploadLabourLicence: async (
    uri: string,
    filename: string,
    mimeType: string
  ): Promise<string> => {
    const token = await getAccessToken();
    const endpointUrl = `${ENV.API_BASE_URL}/api/v1/user/upload-labour-licence`;
    let status: number;
    let rawBody: string;
    if (Platform.OS === 'web') {
      const r = await uploadMultipartWeb(endpointUrl, uri, 'licence', mimeType, token);
      status = r.status; rawBody = r.body;
    } else {
      const r = await FileSystem.uploadAsync(endpointUrl, uri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'licence',
        mimeType,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      status = r.status; rawBody = r.body;
    }
    if (status >= 400) {
      const parsed = safeParse<{ message?: string }>(rawBody);
      throw new Error(parsed?.message ?? `Upload failed (${status})`);
    }
    const json = safeParse<{ success: boolean; labourLicenceUrl: string; message?: string }>(rawBody);
    if (!json?.success) throw new Error(json?.message ?? 'Upload failed');
    return json.labourLicenceUrl;
  },

  /** Remove agent's labour licence */
  deleteLabourLicence: (): Promise<void> =>
    apiClient.delete('/api/v1/user/labour-licence').then(() => undefined),
};
