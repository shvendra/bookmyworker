import { apiClient } from '../client';
import type { AgentStats, Lead } from '../../../shared/types/domain';

export interface WorkerItem {
  _id: string;
  name: string;
  phone: string;
  district?: string;
  state?: string;
  status: 'Verified' | 'Unverified' | 'Block';
  areasOfWork?: string[];
  profilePhoto?: string;
  createdAt: string;
}

export const agentApi = {
  getStats: () =>
    apiClient.get<AgentStats>('/api/v1/user/agent/stats').then((r) => r.data),

  getMyLeads: (params?: { page?: number; callStatus?: string }) =>
    apiClient
      .get<{ leads: Lead[]; total: number }>('/api/v1/user/leads', { params })
      .then((r) => r.data),

  updateLead: (leadId: string, data: { callStatus: string; notes?: string }) =>
    apiClient.put(`/api/v1/admin/${leadId}/lead-status`, data).then((r) => r.data),

  getActiveRequirements: (params?: { page?: number }) =>
    apiClient
      .get('/api/v1/application', { params: { status: 'open', ...params } })
      .then((r) => r.data),

  getWorkStream: (params?: { page?: number }) =>
    apiClient
      .get('/api/v1/application/update-stream-moreinfo', { params })
      .then((r) => r.data),

  getTransactionsByAgent: (agentId: string) =>
    apiClient
      .get(`/api/v1/payment/transactions/by-agent/${agentId}`)
      .then((r) => r.data),

  registerWorker: (formData: FormData) =>
    apiClient.post('/api/v1/job/post', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data),

  getMyWorkers: (params?: { page?: number; limit?: number }) =>
    apiClient
      .get<{ success: boolean; workers: WorkerItem[]; total: number; page: number; pages: number }>(
        '/api/v1/user/my-workers',
        { params },
      )
      .then((r) => r.data),
};
