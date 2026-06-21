import { apiClient } from '../client';
import { getAccessToken } from '../../storage/authStorage';
import { ENV } from '../../config/env';
import type { WorkerProfile, AttendanceRecord } from '../../../shared/types/domain';

export interface WorkerSearchParams {
  role?: string;
  state?: string;
  district?: string;
  city?: string;
  block?: string;
  category?: string;
  workerType?: string;
  /** One or more sub-category values (comma-joined) to narrow within a category. */
  subCategory?: string;
  workerGroup?: string;
  gender?: string;
  minAge?: number;
  maxAge?: number;
  status?: string | string[];
  page?: number;
  limit?: number;
  qualification?: string;
  /** When true, only return workers who have uploaded a resume (backend `hasResume`). */
  hasResume?: boolean;
}

export interface RawAgent {
  _id: string;
  name: string;
  phone: string;
  role?: string;
  status?: string;
  state?: string;
  district?: string;
  block?: string;
  areasOfWork?: string[];
  categories?: string[];
  fixedSalary?: number;
  salaryFrom?: number;
  salaryTo?: number;
  workExperience?: number;
  profilePhoto?: string;
  rating?: number;
  totalRatings?: number;
  dob?: string | number;
  gender?: string;
  veryfiedBage?: boolean;
  workerSubType?: string;
  agentType?: string;
  createdAt?: string;
  resumeUrl?: string;
  labourLicenceUrl?: string;
}

export interface GetAllAgentsResponse {
  success: boolean;
  agents: RawAgent[];
  pagination?: { totalPages: number; currentPage: number; totalCount: number; total?: number };
}

export interface SmartMatchWorker {
  workerId: string;
  bmwId?: string;
  name: string;
  photo?: string;
  role?: string;
  gender?: string;
  district?: string;
  state?: string;
  categories?: string[];
  avgRating?: number;
  totalRatings?: number;
  verified?: boolean;
  matchScore: number;
  reliability: string;
  reason: string;
}

export interface SmartMatchResponse {
  success: boolean;
  matchedCount?: number;
  matches: SmartMatchWorker[];
  backups: SmartMatchWorker[];
}

export interface WorkerDetail {
  _id: string;
  name: string;
  role?: string;
  status?: string;
  state?: string;
  district?: string;
  block?: string;
  profilePhoto?: string;
  areasOfWork?: string[];
  fixedSalary?: number;
  salaryFrom?: number;
  salaryTo?: number;
  workExperience?: number;
  rating?: number;
  totalRatings?: number;
  dob?: string | number;
  gender?: string;
  veryfiedBage?: boolean;
  bio?: string;
  about?: string;
  categories?: string[];
  workerGroup?: string;
  resumeUrl?: string;
  labourLicenceUrl?: string;
  certificates?: Array<{ url: string; name?: string; fileType?: string }>;
}

export interface WorkerDashboardData {
  profile: WorkerProfile;
  todayAttendance?: AttendanceRecord;
  activeRequirements: number;
  totalEarnings: number;
  pendingPayouts: number;
  recentJobs: Array<{ id: string; title: string; employer: string; date: string; status: string }>;
}

function mapAgentToWorkerProfile(u: RawAgent): WorkerProfile {
  return {
    id: u._id,
    fullName: u.name,
    phone: u.phone,
    category: (u.areasOfWork?.[0]) ?? '',
    state: u.state ?? '',
    district: u.district ?? '',
    tehsil: u.block ?? '',
    experienceYears: typeof u.workExperience === 'number' ? u.workExperience : 0,
    rating: u.rating ?? 0,
    verified: u.status === 'Verified',
    profileImage: u.profilePhoto,
    kycStatus: u.status === 'Verified' ? 'verified' : (u.status === 'Block' || u.status === 'Rejected') ? 'rejected' : 'pending',
    available: u.status !== 'Block',
    dailyRate: u.fixedSalary ?? u.salaryFrom,
    skills: u.areasOfWork,
  };
}

export const workerApi = {
  getAllAgents: async (params: WorkerSearchParams) => {
    const response = await apiClient.get<GetAllAgentsResponse>('/api/v1/user/getAllAgents', {
      params: {
        state: params.state || undefined,
        city: params.city || params.district || undefined,
        block: params.block || undefined,
        workerType: params.workerType || undefined,
        subCategory: params.subCategory || undefined,
        workerGroup: params.workerGroup || undefined,
        role: params.role || undefined,
        gender: params.gender || undefined,
        minAge: params.minAge || undefined,
        maxAge: params.maxAge || undefined,
        status: params.status || undefined,
        qualification: params.qualification || undefined,
        hasResume: params.hasResume ? 'true' : undefined,
        page: params.page ?? 1,
        limit: params.limit ?? 25,
      },
    });
    const agents = response.data?.agents ?? [];
    const pagination = response.data?.pagination;
    const lim   = params.limit ?? 25;
    const total = pagination?.total ?? pagination?.totalCount ?? agents.length;
    // The backend's pagination only sends { page, limit, total, hasMore } (no totalPages),
    // so derive totalPages from total + limit — otherwise infinite scroll never advances.
    const pages = pagination?.totalPages ?? (total > 0 ? Math.ceil(total / lim) : 1);
    return {
      workers: agents.map(mapAgentToWorkerProfile),
      rawAgents: agents,
      total,
      pages,
      currentPage: pagination?.currentPage ?? params.page ?? 1,
    };
  },

  unlockNumber: async (agentId: string): Promise<{
    phone?: string;
    alternate?: string;  // worker's optional secondary number — revealed by the SAME unlock (no extra charge)
    message?: string;
    alreadyHired?: boolean;  // true when worker has Joined status — contact is free
    usedFreeContact?: boolean;  // true when a gifted free contact was used (no charge)
    freeContactsRemaining?: number;  // free contacts left after this unlock
    code?: 'SUBSCRIPTION_REQUIRED' | 'SUBSCRIPTION_EXPIRED' | 'CONTACT_LIMIT';
  }> => {
    const res = await apiClient.get<{
      phone?: string;
      alternate?: string;
      message?: string;
      alreadyHired?: boolean;
      usedFreeContact?: boolean;
      freeContactsRemaining?: number;
      code?: string;
    }>(`/api/v1/user/unlock-number/${agentId}`);
    return res.data;
  },

  saveWorkerRemark: async (workerId: string, status: string): Promise<void> => {
    await apiClient.post('/api/v1/user/worker-remark', { workerId, status });
  },

  getWorkerRemarks: async (): Promise<Array<{ workerId: string; status: string }>> => {
    const res = await apiClient.get<Array<{ workerId: string; status: string }>>('/api/v1/user/worker-remarks');
    return res.data ?? [];
  },

  search: async (params: WorkerSearchParams) => {
    return workerApi.getAllAgents(params);
  },

  // AI Smart Match — ranked best-fit workers for the current requirement.
  smartMatch: async (params: {
    category?: string;
    categories?: string[];
    subCategory?: string;
    state?: string;
    district?: string;
    limit?: number;
    backups?: number;
  }): Promise<SmartMatchResponse> => {
    const res = await apiClient.post<SmartMatchResponse>('/api/v1/smart-match/match', {
      category: params.category || undefined,
      categories: params.categories?.length ? params.categories : undefined,
      subCategory: params.subCategory || undefined,
      state: params.state || undefined,
      district: params.district || undefined,
      limit: params.limit ?? 8,
      backups: params.backups ?? 3,
    });
    return res.data;
  },

  getWorkerById: async (id: string): Promise<WorkerDetail> => {
    const res = await apiClient.get<{ success: boolean; worker: WorkerDetail }>(`/api/v1/user/worker/${id}`);
    return res.data.worker;
  },

  getProfile: (id: string) =>
    apiClient.get<WorkerProfile>(`/api/v1/user/${id}`).then((r) => r.data),

  // Fetch profiles for interested agents by ID — works for all roles (agent/worker/selfworker)
  // Fetches each profile individually in parallel because getAllAgentsAdmin ignores the ids filter
  getAgentsByIds: async (ids: string[]): Promise<RawAgent[]> => {
    if (!ids.length) return [];
    type WorkerResponse = { success: boolean; worker: WorkerDetail & { phone?: string; fullName?: string } };
    const results = await Promise.allSettled(
      ids.map((id) =>
        apiClient.get<WorkerResponse>(`/api/v1/user/worker/${id}`).then((r) => r.data.worker)
      )
    );
    return results
      .filter(
        (r): r is PromiseFulfilledResult<WorkerDetail & { phone?: string; fullName?: string }> =>
          r.status === 'fulfilled' && r.value != null
      )
      .map((r) => ({
        _id: r.value._id,
        name: r.value.name ?? r.value.fullName ?? '',
        phone: r.value.phone ?? '',
        state: r.value.state,
        district: r.value.district,
        block: r.value.block,
        role: r.value.role,
        status: r.value.status,
      }));
  },

  getDashboard: () =>
    apiClient.get<WorkerDashboardData>('/api/v1/worker/dashboard').then((r) => r.data),

  updateProfile: (data: Partial<WorkerProfile>) =>
    apiClient.put<WorkerProfile>('/api/v1/user/update', data).then((r) => r.data),

  getAttendance: (params?: { requirementId?: string; from?: string; to?: string }) =>
    apiClient
      .get<AttendanceRecord[]>('/api/v1/attendance/get-by-requirement', { params })
      .then((r) => r.data),

  markAttendance: (data: { requirementId: string; type: 'check-in' | 'check-out'; location?: string }) =>
    apiClient.post<AttendanceRecord>('/api/v1/attendance/add-attendance', data).then((r) => r.data),

  uploadResume: async (fileUri: string, fileName: string): Promise<string> => {
    const ext = fileName.split('.').pop()?.toLowerCase() ?? 'pdf';
    const mime = ext === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const form = new FormData();

    if (fileUri.startsWith('blob:') || fileUri.startsWith('data:')) {
      // Web/browser: expo-document-picker returns a blob: URI on web.
      // form.append with a plain object sends "[object Object]" — not a file.
      // Must fetch the actual blob and wrap it as a File so the browser builds
      // a proper multipart part that express-fileupload can parse.
      const blobResponse = await fetch(fileUri);
      const blob = await blobResponse.blob();
      form.append('resume', new File([blob], fileName, { type: mime }), fileName);
    } else {
      // React Native (device & emulator): expo-document-picker returns a file:// URI.
      // RN's native XHR layer understands { uri, name, type } and builds the
      // multipart part correctly — native fetch auto-sets the boundary header.
      form.append('resume', { uri: fileUri, name: fileName, type: mime } as unknown as Blob);
    }

    const token = await getAccessToken();
    const response = await fetch(`${ENV.API_BASE_URL}/api/v1/user/upload-resume`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({})) as { message?: string };
      throw new Error(err.message ?? 'Upload failed');
    }
    const data = await response.json() as { success: boolean; resumeUrl: string };
    return data.resumeUrl;
  },
};
