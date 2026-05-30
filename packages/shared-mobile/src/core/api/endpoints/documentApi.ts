import { apiClient } from '../client';

// ── Types ─────────────────────────────────────────────────────────────────────

export type DocType =
  | 'Work Agreement'
  | 'Statement of Work'
  | 'GST Invoice'
  | 'Payment Receipt'
  | 'Identity Proof'
  | 'Other';

export interface EmployerDocument {
  _id: string;
  requirementId: string;
  employerId: string;
  name: string;
  docType: DocType;
  fileUrl: string;
  fileKey: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  updatedAt: string;
}

export interface UploadDocumentPayload {
  requirementId: string;
  name: string;
  docType?: DocType;
  fileUri: string;       // local file URI from document/image picker
  fileName: string;
  mimeType: string;
}

// ── API methods ───────────────────────────────────────────────────────────────

export const documentApi = {
  // Upload a document. Uses FormData so the file is sent as multipart.
  upload: async (payload: UploadDocumentPayload): Promise<EmployerDocument> => {
    const form = new FormData();
    form.append('requirementId', payload.requirementId);
    form.append('name', payload.name);
    form.append('docType', payload.docType ?? 'Other');
    // React Native FormData appends files as { uri, name, type }
    form.append('document', {
      uri:  payload.fileUri,
      name: payload.fileName,
      type: payload.mimeType,
    } as unknown as Blob);

    const res = await apiClient.post<{ success: boolean; document: EmployerDocument }>(
      '/api/v1/documents/upload',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return res.data.document;
  },

  // List documents for a requirement.
  list: (requirementId: string) =>
    apiClient
      .get<{ success: boolean; documents: EmployerDocument[] }>(
        `/api/v1/documents/requirement/${requirementId}`
      )
      .then((r) => r.data.documents ?? []),

  // Delete a document.
  delete: (documentId: string) =>
    apiClient
      .delete<{ success: boolean; message: string }>(`/api/v1/documents/${documentId}`)
      .then((r) => r.data),
};
