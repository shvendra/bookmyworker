import { apiClient } from '../client';
import type { JobRequirement, WorkerProfile } from '../../../shared/types/domain';

export interface WorkerFilters {
  state?: string;
  district?: string;
  tehsil?: string;
  category?: string;
  page?: number;
  limit?: number;
}

export interface RequirementPayload {
  title: string;
  category: string;
  workerCount: number;
  state: string;
  district: string;
  tehsil: string;
  location: string;
}

export interface InvitationItem {
  id: string;
  workerName: string;
  requirementTitle: string;
  status: 'pending' | 'accepted' | 'declined';
}

export interface AttendanceSummary {
  presentDays: number;
  absentDays: number;
  lateDays: number;
}

export const fetchWorkers = async (filters: WorkerFilters): Promise<WorkerProfile[]> => {
  const response = await apiClient.get('/workers', { params: filters });
  const body = response.data?.data ?? response.data;
  return (body.workers ?? body.items ?? body ?? []) as WorkerProfile[];
};

export const postRequirement = async (payload: RequirementPayload): Promise<JobRequirement> => {
  const response = await apiClient.post('/requirements', payload);
  return (response.data?.data ?? response.data) as JobRequirement;
};

export const fetchInvitations = async (): Promise<InvitationItem[]> => {
  const response = await apiClient.get('/invitations');
  const body = response.data?.data ?? response.data;
  return (body.invitations ?? body.items ?? body ?? []) as InvitationItem[];
};

export const fetchAttendanceSummary = async (): Promise<AttendanceSummary> => {
  const response = await apiClient.get('/attendance/summary');
  return (response.data?.data ?? response.data) as AttendanceSummary;
};
