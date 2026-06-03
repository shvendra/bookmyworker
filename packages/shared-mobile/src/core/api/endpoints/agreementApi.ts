import { apiClient } from '../client';

export interface AgreementEmployer {
  name?: string;
  company?: string;
  address?: string;
  aadhaar?: string;
  gst?: string;
  photoUrl?: string;
  phone?: string;
}

export interface AgreementWork {
  title?: string;
  description?: string;
  numberOfWorkers?: string;
  location?: string;
  duration?: string;
  dutyHours?: string;
  weeklyOff?: string;
  overtime?: string;
  wages?: string;
  paymentCycle?: string;
  paymentMode?: string;
  advance?: string;
  stay?: string;
  food?: string;
  transport?: string;
  safetyGears?: string;
  experienceLevel?: string;
  licenseRequired?: string;
  uniform?: string;
  reportingPerson?: string;
  attendance?: string;
}

export interface Agreement {
  _id: string;
  ern: string;
  employer: AgreementEmployer;
  work: AgreementWork;
  terms: string[];
  signedAt: string | null;
  signatureUrl: string | null;
  createdAt: string;
}

interface MyAgreementsResponse {
  success: boolean;
  agreements: Agreement[];
}

interface AgreementResponse {
  success: boolean;
  agreement: Agreement;
}

/** All agreements belonging to the logged-in employer. */
export const getMyAgreements = async (): Promise<Agreement[]> => {
  const res = await apiClient.get<MyAgreementsResponse>('/api/v1/admin/agreements/mine');
  return res.data.agreements;
};

/** A single agreement by id. */
export const getAgreement = async (id: string): Promise<Agreement> => {
  const res = await apiClient.get<AgreementResponse>(`/api/v1/admin/agreements/${id}`);
  return res.data.agreement;
};

/**
 * Sign an agreement. `signatureDataUrl` MUST be a base64 PNG data URL
 * (e.g. "data:image/png;base64,....").
 */
export const signAgreement = async (id: string, signatureDataUrl: string): Promise<void> => {
  await apiClient.post(`/api/v1/admin/agreements/${id}/sign`, { signature: signatureDataUrl });
};
