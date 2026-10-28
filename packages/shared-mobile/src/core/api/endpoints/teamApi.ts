import { apiClient } from '../client';

// Employer Team Access — owner screens + team-member login. Mirrors backend routes/employerTeamRoutes.js and routes/teamAccessRoutes.js.

export interface TeamPermission { key: string; label: string; desc: string }
export interface TeamMember {
  _id: string;
  name: string;
  phone: string;
  permissions: string[];
  status: 'active' | 'suspended';
  lastLoginAt?: string | null;
  lastActiveAt?: string | null;
}
export interface TeamOverview {
  eligibility: { eligible: boolean; message: string; seats: number };
  seats: { used: number; limit: number };
  link: { slug: string; active: boolean } | null;
  members: TeamMember[];
  permissions: TeamPermission[];
  company: string;
}
export interface TeamActivityRow { _id: string; memberName: string; action: string; detail?: string; at: string }

export interface TeamLoginResult {
  token: string;
  company: string;
  member: { name: string; permissions: string[] };
}

const OWNER = '/api/v1/employer-team';
const PUBLIC = '/api/v1/team-access';
const APP = { headers: { 'X-Team-Client': 'app' } };

export const teamApi = {
  // ── owner ───────────────────────────────────────────────────────────────
  getTeam: (): Promise<TeamOverview> => apiClient.get(OWNER).then((r) => r.data),
  addMember: (body: { name: string; phone: string; permissions: string[] }): Promise<{ member: TeamMember }> =>
    apiClient.post(`${OWNER}/members`, body).then((r) => r.data),
  updateMember: (id: string, body: { name?: string; permissions?: string[]; status?: 'active' | 'suspended' }): Promise<{ member: TeamMember }> =>
    apiClient.put(`${OWNER}/members/${id}`, body).then((r) => r.data),
  removeMember: (id: string): Promise<void> => apiClient.delete(`${OWNER}/members/${id}`).then(() => undefined),
  rotateLink: (): Promise<{ link: { slug: string } }> => apiClient.post(`${OWNER}/link/rotate`, {}).then((r) => r.data),
  getActivity: (limit = 30): Promise<{ activity: TeamActivityRow[] }> => apiClient.get(`${OWNER}/activity`, { params: { limit } }).then((r) => r.data),

  // ── team member login (no password — mobile + OTP only) ──────────────────
  publicLink: (slug: string): Promise<{ company: string; active: boolean; message?: string }> =>
    apiClient.get(`${PUBLIC}/public/${encodeURIComponent(slug)}`).then((r) => r.data),
  sendOtp: (slug: string, phone: string): Promise<{ message: string }> =>
    apiClient.post(`${PUBLIC}/send-otp`, { slug, phone }).then((r) => r.data),
  login: (slug: string, phone: string, otp: string): Promise<TeamLoginResult> =>
    apiClient.post(`${PUBLIC}/login`, { slug, phone, otp }, APP).then((r) => r.data),
};

/** The link an owner shares with a member (the CRM page also works in a browser). */
export const teamLinkUrl = (slug: string): string => `https://www.bookmyworkers.com/app/team/${slug}`;
