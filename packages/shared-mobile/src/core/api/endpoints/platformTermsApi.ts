import { apiClient } from '../client';

/** Current employer's one-time platform Terms & Conditions acceptance status. */
export interface PlatformTermsStatus {
  /** Server-side terms version the employer must accept. */
  version: string;
  /** True only when accepted AND the accepted version matches the current one. */
  accepted: boolean;
  /** ISO date of acceptance (null when not accepted). */
  acceptedAt: string | null;
  /** Name typed when signing (null when not accepted). */
  name: string | null;
}

interface PlatformTermsResponse extends PlatformTermsStatus {
  success: boolean;
}

/** Fetch the logged-in employer's platform-terms acceptance status. */
export const getPlatformTermsStatus = async (): Promise<PlatformTermsStatus> => {
  const res = await apiClient.get<PlatformTermsResponse>('/api/v1/user/platform-terms');
  const { version, accepted, acceptedAt, name } = res.data;
  return { version, accepted, acceptedAt, name };
};

/**
 * Record one-time acceptance of the platform terms.
 * `signatureDataUrl` is a base64 PNG data URL (typed-name signature); `name`
 * is the typed signing name (required server-side).
 */
export const acceptPlatformTerms = async (
  name: string,
  signatureDataUrl: string,
): Promise<PlatformTermsStatus> => {
  const res = await apiClient.post<PlatformTermsResponse>('/api/v1/user/platform-terms/accept', {
    name,
    signature: signatureDataUrl,
  });
  const { version, accepted, acceptedAt, name: signedName } = res.data;
  return { version, accepted, acceptedAt, name: signedName };
};
