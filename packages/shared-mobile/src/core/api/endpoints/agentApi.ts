import { apiClient } from '../client';
import type { AgentStats, Lead } from '../../../shared/types/domain';

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

  // Returns SelfWorker users registered by this agent (postedBy = agent _id)
  getMyWorkers: (params?: { page?: number }) =>
    apiClient
      .get<{ success?: boolean; myJobs?: unknown[]; workers?: unknown[]; data?: unknown[]; total?: number }>(
        '/api/v1/job/getmyjobs',
        { params },
      )
      .then((r) => r.data),
};
