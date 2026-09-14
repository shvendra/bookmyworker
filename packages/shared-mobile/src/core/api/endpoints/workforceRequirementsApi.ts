import { apiClient } from '../client';

// ── Types ─────────────────────────────────────────────────────────────────────
// Mirrors backend/models/PrivateWorkforceRequirement.js.
// See backend/controllers/privateRequirementController.js.

export type DurationType = 'Ongoing' | 'FixedTerm';
export type Urgency = 'Standard' | 'Urgent';
export type PayModel = 'Monthly' | 'Daily' | 'Hourly';
export type RequirementStatus =
  | 'Submitted'
  | 'UnderReview'
  | 'Approved'
  | 'Rejected'
  | 'PartiallyFulfilled'
  | 'Fulfilled'
  | 'Closed'
  | 'Cancelled';

interface PopulatedRef {
  _id: string;
  name?: string;
  legalName?: string;
  tradeName?: string;
  siteName?: string;
  siteType?: string;
  phone?: string;
}

// Employer-facing shape: agreedWorkerRate / agreedWorkerPayModel / reviewNotes
// are stripped server-side (sanitizeForEmployer in privateRequirementController.js)
// for the owning Employer's own requests — never assume or render them.
export interface PrivateWorkforceRequirement {
  _id: string;
  pwrNumber: string;
  clientCompanyId: string | PopulatedRef;
  siteId: string | PopulatedRef;
  workTypeId: string | PopulatedRef;
  subWorkTypeId?: string | PopulatedRef;
  skillsRequired?: Array<string | PopulatedRef>;
  numberOfWorkers: number;
  shiftTiming?: string;
  durationType: DurationType;
  startDate?: string;
  endDate?: string;
  urgency: Urgency;
  budgetNote?: string;
  specialInstructions?: string;
  status: RequirementStatus;
  assignedAccountManagerId?: string | PopulatedRef;
  agreedBillingRate?: number;
  agreedBillingPayModel?: PayModel;
  rejectionReason?: string;
  createdByUserId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateWorkforceRequirementPayload {
  siteId: string;
  workTypeId: string;
  subWorkTypeId?: string;
  skillsRequired?: string[];
  numberOfWorkers: number;
  shiftTiming?: string;
  durationType: DurationType;
  startDate?: string;
  endDate?: string;
  urgency?: Urgency;
  budgetNote?: string;
  specialInstructions?: string;
}

export interface RequirementAttachment {
  _id: string;
  requirementId: string;
  employerId: string;
  name: string;
  docType: string;
  fileUrl: string;
  fileKey: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  updatedAt: string;
}

export interface UploadRequirementAttachmentPayload {
  requirementId: string;
  name?: string;
  docType?: string;
  fileUri: string; // local file URI from document/image picker
  fileName: string;
  mimeType: string;
}

// ── API methods ───────────────────────────────────────────────────────────────

export const workforceRequirementsApi = {
  // Employer self-service: only returns requirements under the caller's own
  // Client Company (empty array if not linked yet, never an error).
  // See listMyRequirements in backend/controllers/privateRequirementController.js.
  listMine: () =>
    apiClient
      .get<{ success: boolean; requirements: PrivateWorkforceRequirement[] }>('/api/v1/workforce-requirements/mine')
      .then((r) => r.data.requirements ?? []),

  create: (payload: CreateWorkforceRequirementPayload) =>
    apiClient
      .post<{ success: boolean; requirement: PrivateWorkforceRequirement }>('/api/v1/workforce-requirements', payload)
      .then((r) => r.data.requirement),

  // Owner Employer OR CRM (inline check server-side) — an Employer always
  // gets the sanitized shape.
  getById: (id: string) =>
    apiClient
      .get<{ success: boolean; requirement: PrivateWorkforceRequirement }>(`/api/v1/workforce-requirements/${id}`)
      .then((r) => r.data.requirement),

  // From the Employer app, the only reachable transition is Cancelled, and
  // only while the requirement is Submitted/UnderReview (enforced server-side
  // via EMPLOYER_ALLOWED_TRANSITIONS) — everything else 400s.
  //
  // IMPORTANT: cancelling while there's an outstanding balance on a prior
  // invoice is blocked with an HTTP 400 whose `message` field is the exact,
  // user-facing copy to show ("You have an outstanding payment of ₹X...").
  // apiClient's response interceptor already reads `error.response.data.message`
  // into the rejected error's `.message` (see toApiError/humanMessage in
  // core/api/client.ts) — this function deliberately does NOT catch or rewrap
  // that error, so callers must surface `error.message` verbatim, never a
  // generic "Something went wrong" toast.
  updateStatus: (id: string, status: RequirementStatus) =>
    apiClient
      .put<{ success: boolean; requirement: PrivateWorkforceRequirement }>(
        `/api/v1/workforce-requirements/${id}/status`,
        { status },
      )
      .then((r) => r.data.requirement),

  // Attachments — reuses the EmployerDocument + S3 upload pattern (see
  // documentApi.ts's upload()). Owner Employer OR CRM (inline check server-side).
  uploadAttachment: async (payload: UploadRequirementAttachmentPayload): Promise<RequirementAttachment> => {
    const form = new FormData();
    if (payload.name) form.append('name', payload.name);
    form.append('docType', payload.docType ?? 'Other');
    // React Native FormData appends files as { uri, name, type }
    form.append('document', {
      uri: payload.fileUri,
      name: payload.fileName,
      type: payload.mimeType,
    } as unknown as Blob);

    const res = await apiClient.post<{ success: boolean; document: RequirementAttachment }>(
      `/api/v1/workforce-requirements/${payload.requirementId}/attachments`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return res.data.document;
  },

  listAttachments: (requirementId: string) =>
    apiClient
      .get<{ success: boolean; documents: RequirementAttachment[] }>(
        `/api/v1/workforce-requirements/${requirementId}/attachments`,
      )
      .then((r) => r.data.documents ?? []),

  deleteAttachment: (documentId: string) =>
    apiClient
      .delete<{ success: boolean; message: string }>(`/api/v1/workforce-requirements/attachments/${documentId}`)
      .then((r) => r.data),
};
