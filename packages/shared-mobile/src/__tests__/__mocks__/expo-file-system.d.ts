declare module 'expo-file-system' {
  export const FileSystemUploadType: { MULTIPART: string };
  export function uploadAsync(
    url: string,
    fileUri: string,
    options: {
      httpMethod?: string;
      uploadType?: string;
      fieldName?: string;
      mimeType?: string;
      headers?: Record<string, string>;
      parameters?: Record<string, string>;
    }
  ): Promise<{ status: number; body: string }>;
}
