import { apiClient } from '../client';

// Quarterly "How is BookMyWorker working for you?" — mirrors backend routes/employerSelfFeedbackRoutes.js (the CRM uses the same endpoints).
// Keep the option values in sync with backend/utils/selfFeedback.js: the server only accepts these.

export interface SelfFeedbackStatus {
  /** false when the employer has no running paid plan (no feedback menu / popup then). */
  activePlan?: boolean;
  /** Show the popup now. */
  due?: boolean;
  /** The menu may open the form (false for 90 days after an answer). */
  canSubmit?: boolean;
  lastSubmittedAt?: string | null;
  nextAvailableAt?: string | null;
}

export interface SelfFeedbackBody {
  overall: number;
  ratings: Record<string, number>;
  supportReceived: string;
  supportIssue: string;
  pricing: string;
  recommend: number | null;
  renewIntent: string;
  improve: string[];
  comment: string;
  platform: 'app';
}

const BASE = '/api/v1/employer-self-feedback';

export const selfFeedbackApi = {
  status: (): Promise<SelfFeedbackStatus> => apiClient.get(`${BASE}/status`).then((r) => r.data ?? {}),
  dismiss: (): Promise<void> => apiClient.post(`${BASE}/dismiss`, {}).then(() => undefined),
  submit: (body: SelfFeedbackBody): Promise<{ needsFollowUp: boolean }> =>
    apiClient.post(`${BASE}/submit`, body).then((r) => ({ needsFollowUp: !!r.data?.needsFollowUp })),
};
