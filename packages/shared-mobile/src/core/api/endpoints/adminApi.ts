import { apiClient } from '../client';
import type { AppRole, DashboardStats, KycStatus, Lead, UserProfile } from '../../../shared/types/domain';

// Map raw MongoDB user document (has _id / name) to frontend UserProfile (id / fullName)
interface RawUser {
  _id: string;
  name?: string;
  phone?: string;
  role?: string;
  status?: string;
  email?: string;
  state?: string;
  district?: string;
  profilePhoto?: string;
  [key: string]: unknown;
}

function mapRole(r?: string): AppRole {
  switch (r) {
    case 'Employer': return 'employer';
    case 'Agent': return 'agent';
    case 'SelfWorker':
    case 'Worker': return 'worker';
    case 'Admin': return 'admin';
    case 'SuperAdmin': return 'superadmin';
    default: return 'worker';
  }
}

function mapStatus(s?: string): KycStatus {
  if (s === 'Verified') return 'verified';
  if (s === 'Block') return 'rejected';
  return 'pending';
}

function mapRawUser(u: RawUser): UserProfile {
  return {
    id: String(u._id),
    fullName: u.name ?? '—',
    phone: u.phone ?? '',
    role: mapRole(u.role),
    kycStatus: mapStatus(u.status),
    language: 'en',
    email: u.email,
    state: u.state,
    district: u.district,
    profileImage: u.profilePhoto,
  };
}

export interface RegistrationSummary {
  Agent: number;
  Employer: number;
  SelfWorker: number;
  Worker: number;
}

export interface RegistrationStatsResponse {
  summary: RegistrationSummary;
  [role: string]: unknown;
}

export const adminApi = {
  getDashboardStats: () =>
    apiClient.get<DashboardStats>('/api/v1/admin/dashboard-stats').then((r) => r.data),

  getAllAgentsAdmin: (params?: { page?: number; limit?: number }) =>
    apiClient
      .get<{ agents: RawUser[]; total: number }>('/api/v1/user/getAllAgentsAdmin', { params })
      .then((r) => ({ agents: r.data.agents.map(mapRawUser), total: r.data.total })),

  getAllUsers: (params?: { page?: number; role?: string; status?: string }) =>
    apiClient
      .get<{ users: RawUser[]; total?: number; count?: number; totalUsersCount?: number }>('/api/v1/admin/allUsers', { params })
      .then((r) => ({
        users: (r.data.users ?? []).map(mapRawUser),
        total: r.data.total ?? r.data.count ?? r.data.totalUsersCount ?? 0,
      })),

  verifyUser: (userId: string) =>
    apiClient.put(`/api/v1/admin/${userId}/verify`).then((r) => r.data),

  updateFollowupStatus: (userId: string, status: string) =>
    apiClient
      .put(`/api/v1/admin/${userId}/followup-status`, { status })
      .then((r) => r.data),

  updateLeadStatus: (userId: string, data: Record<string, unknown>) =>
    apiClient.put(`/api/v1/admin/${userId}/lead-status`, data).then((r) => r.data),

  setUserRole: (userId: string, role: string) =>
    apiClient.post('/api/v1/user/setrole', { userId, role }).then((r) => r.data),

  getLeads: (params?: { page?: number; status?: string; agentId?: string }) =>
    apiClient
      .get<{ leads: Lead[]; total: number }>('/api/v1/user/leads', { params })
      .then((r) => r.data),

  getMonitoringHealth: () =>
    apiClient.get('/api/v1/monitoring/health').then((r) => r.data),

  getPublicSettings: () =>
    apiClient.get('/api/v1/settings/public').then((r) => r.data),

  updateSettings: (settings: Record<string, unknown>) =>
    apiClient.put('/api/v1/settings/update', settings).then((r) => r.data),

  unlockContact: (agentId: string) =>
    apiClient.put(`/api/v1/user/unlock-contact/${agentId}`).then((r) => r.data),

  rejectUser: (userId: string, reason?: string) =>
    apiClient.put(`/api/v1/admin/${userId}/reject`, { reason }).then((r) => r.data),

  getUserDocuments: (userId: string) =>
    apiClient.get(`/api/v1/user/documents/${userId}`).then((r) => r.data),

  getRegistrationStats: (params?: { type?: 'daily' | 'monthly'; year?: string }) =>
    apiClient
      .get<RegistrationStatsResponse>('/api/view/registrations', { params })
      .then((r) => r.data),
};
