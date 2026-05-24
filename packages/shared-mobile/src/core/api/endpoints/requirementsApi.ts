import { apiClient } from '../client';
import type { AppRole, JobRequirement, Application, AttendanceRecord } from '../../../shared/types/domain';

export interface JobFilters {
  page?: number;
  limit?: number;
  role?: string;
  state?: string;
  district?: string;
  search?: string;
  category?: string;
  status?: string;
}

export interface SubmitApplicationPayload {
  jobId: string;
  coverLetter?: string;
}

export type RequirementType = 'Daily_Wages' | 'Contract_Based' | 'Supply_Based' | 'Office_Staff';

export interface CreateRequirementPayload {
  workType: string;
  subCategory: string;
  workerQuantitySkilled: number;
  workerQuantityUnskilled?: number;
  ageGroup?: string;
  state: string;
  district: string;
  tehsil?: string;
  pinCode?: string;
  workerNeedDate: string;
  inTime?: string;
  outTime?: string;
  remarks: string;
  minBudgetPerWorker: number;
  maxBudgetPerWorker: number;
  salaryType?: 'Daily' | 'Weekly' | 'Monthly';
  estimated_days?: string;
  workLocation?: string;
  latitude?: number;
  longitude?: number;
  req_type?: RequirementType;
  employerId?: string;
  employerName?: string;
  employerPhone?: string;
  accommodationAvailable?: boolean;
  foodAvailable?: boolean;
  transportProvided?: boolean;
  weeklyOff?: boolean;
  overtimeAvailable?: boolean;
  bonus?: boolean;
  incentive?: boolean;
  insuranceAvailable?: boolean;
  pfAvailable?: boolean;
  esicAvailable?: boolean;
}

export interface RequirementFilters {
  status?: string;
  category?: string;
  state?: string;
  district?: string;
  page?: number;
  limit?: number;
}

// Backend response shape from /api/v1/application
export interface RawRequirement {
  _id: string;
  ERN_NUMBER?: string;
  likedBy?: string[];
  workType?: string;
  subCategory?: string;
  district?: string;
  state?: string;
  tehsil?: string;
  workLocation?: string;
  workerNeedDate?: string;
  inTime?: string;
  outTime?: string;
  workerQuantitySkilled?: number;
  workerQuantityUnskilled?: number;
  minBudgetPerWorker?: number;
  maxBudgetPerWorker?: number;
  salaryType?: 'Daily' | 'Weekly' | 'Monthly';
  employerId?: string;
  employerName?: string;
  employerPhone?: string;
  assignedAgentId?: string;
  assignedAgentName?: string;
  assignedAgentPhone?: string;
  intrestedAgents?: Array<{ agentId: string; agentRequiredWage?: number }>;
  status?: string;
  req_type?: string;
  remarks?: string;
  estimated_days?: string;
  accommodationAvailable?: boolean;
  foodAvailable?: boolean;
  transportProvided?: boolean;
  weeklyOff?: boolean;
  overtimeAvailable?: boolean;
  bonus?: boolean;
  incentive?: boolean;
  insuranceAvailable?: boolean;
  pfAvailable?: boolean;
  esicAvailable?: boolean;
  isAgentAccepted?: boolean;
  finalAgentRequiredWage?: number;
  latitude?: number;
  longitude?: number;
  createdAt?: string;
  proposedWorkers?: Array<{
    workerId?: string;
    workerName?: string;
    workerPhone?: string;
    proposedBy?: string;
    proposedByName?: string;
    status: 'pending' | 'approved' | 'rejected';
    rejectionReason?: string;
    proposedAt?: string;
    respondedAt?: string;
  }>;
}

export interface RoleAwareFilters {
  role: AppRole;
  userId?: string;
  serviceArea?: string[];
  district?: string;
  workType?: string;
  subCategory?: string;
  state?: string;
  page?: number;
  limit?: number;
  search?: string;
  myInterests?: boolean;
}

// Serialize params with repeated keys for arrays (district=X&district=Y)
const serializeParams = (params: Record<string, unknown>): string => {
  const parts: string[] = [];
  Object.entries(params).forEach(([k, v]) => {
    if (Array.isArray(v)) {
      v.forEach((val) => {
        if (val !== undefined && val !== null && val !== '') {
          parts.push(`${k}=${encodeURIComponent(String(val))}`);
        }
      });
    } else if (v !== undefined && v !== null && v !== '') {
      parts.push(`${k}=${encodeURIComponent(String(v))}`);
    }
  });
  return parts.join('&');
};

export const requirementsApi = {
  // Mobile-optimised listing: priority-sorted (district→state→India), filter-enabled
  listForRole: (filters: RoleAwareFilters) => {
    const { role, userId, workType, subCategory, state, district, page = 1, limit = 20, search, myInterests } = filters;
    const params: Record<string, unknown> = { page, limit };

    // For employer, scope to their own requirements
    if (role === 'employer' && userId) params.employerId = userId;

    // Optional filters (backend handles location-priority via JWT user)
    if (workType) params.workType = workType;
    if (subCategory) params.subCategory = subCategory;
    if (state) params.state = state;
    if (district) params.district = district;
    if (search?.trim()) params.search = search.trim();
    if (myInterests) params.myInterests = 'true';

    const qs = serializeParams(params);
    return apiClient
      .get<{
        requirements: RawRequirement[];
        pagination?: { totalPages: number; currentPage: number; totalCount: number };
        total?: number;
        myInterestsCount?: number;
      }>(`/api/v1/mobile/requirements?${qs}`)
      .then((r) => ({
        requirements: r.data.requirements ?? [],
        pagination: r.data.pagination ?? {
          totalPages: 1,
          currentPage: page,
          totalCount: r.data.total ?? 0,
        },
        myInterestsCount: r.data.myInterestsCount,
      }));
  },

  list: (params?: RequirementFilters) =>
    apiClient
      .get<{ requirements: JobRequirement[]; total: number }>('/api/v1/application', { params })
      .then((r) => r.data),

  getById: async (id: string): Promise<RawRequirement> => {
    const res = await apiClient.get<{ requirement: RawRequirement }>(`/api/v1/mobile/requirements/${id}`);
    return res.data.requirement;
  },

  create: (payload: CreateRequirementPayload) =>
    apiClient.post<JobRequirement>('/api/v1/application/insertrequirement', payload).then((r) => r.data),

  update: (id: string, payload: Partial<JobRequirement>) =>
    apiClient.put<JobRequirement>(`/api/v1/application/${id}`, payload).then((r) => r.data),

  close: (id: string) =>
    apiClient
      .put(`/api/v1/application/update-status?id=${id}&status=Closed`)
      .then((r) => r.data),

  // Toggle like on a requirement — returns { liked: boolean, likeCount: number }
  toggleLike: (requirementId: string) =>
    apiClient
      .post<{ success: boolean; liked: boolean; likeCount: number }>(`/api/v1/mobile/requirements/${requirementId}/like`)
      .then((r) => r.data),

  // Get all requirements the current user has liked
  getLiked: (page = 1, limit = 50) =>
    apiClient
      .get<{
        requirements: RawRequirement[];
        pagination: { totalPages: number; currentPage: number; totalCount: number };
      }>('/api/v1/mobile/requirements/liked', { params: { page, limit } })
      .then((r) => ({
        requirements: r.data.requirements ?? [],
        pagination: r.data.pagination ?? { totalPages: 1, currentPage: page, totalCount: 0 },
      })),

  // Matches CRM: POST /api/v1/application/:req_id/express-interest with { wage }
  expressInterestWithWage: (requirementId: string, wage: number) =>
    apiClient
      .post(`/api/v1/application/${requirementId}/express-interest`, { wage })
      .then((r) => r.data),

  expressInterest: (requirementId: string) =>
    apiClient
      .post(`/api/v1/application/${requirementId}/express-interest`)
      .then((r) => r.data),

  getApplications: (requirementId: string) =>
    apiClient
      .get<Application[]>(`/api/v1/application/${requirementId}/applications`)
      .then((r) => r.data),

  updateStatus: (id: string, status: string) =>
    apiClient
      .put(`/api/v1/application/update-status?id=${id}&status=${status}`)
      .then((r) => r.data),

  assignAgent: (payload: { agentId: string; ern: string; assignedAgentName: string; assignedAgentPhone: string; finalAgentRequiredWage: number }) =>
    apiClient.put('/api/v1/application/assign', payload).then((r) => r.data),

  unassignOrAccept: (payload: { agentId: string; ern: string; isAgentAccepted: 'Yes' | 'No' }) =>
    apiClient.put('/api/v1/application/unassignOrAccept', payload).then((r) => r.data),

  assignWorker: (payload: { requirementId: string; workerId: string }) =>
    apiClient.post('/api/v1/application/assign', payload).then((r) => r.data),

  getAttendanceByRequirement: (requirementId: string, employerId?: string) => {
    const params = new URLSearchParams();
    params.append('requirement_id', requirementId);
    if (employerId) params.append('employer_id', employerId);
    return apiClient
      .get<{ data?: AttendanceRecord[]; success?: boolean }>(`/api/v1/attendance/get-by-requirement?${params.toString()}`)
      .then((r) => r.data.data ?? []);
  },

  approveAttendance: (attendanceId: string) =>
    apiClient.put(`/api/v1/attendance/update-requ?id=${attendanceId}`).then((r) => r.data),

  getMyRequirements: () =>
    apiClient
      .get<{ myJobs?: JobRequirement[]; jobs?: JobRequirement[] } | JobRequirement[]>('/api/v1/job/getmyjobs')
      .then((r) => {
        const body = r.data;
        if (Array.isArray(body)) return body;
        return (body as { myJobs?: JobRequirement[]; jobs?: JobRequirement[] }).myJobs
          ?? (body as { myJobs?: JobRequirement[]; jobs?: JobRequirement[] }).jobs
          ?? [];
      }),

  getAllJobs: (params?: JobFilters) =>
    apiClient
      .get<{ jobs?: JobRequirement[]; data?: JobRequirement[]; total?: number } | JobRequirement[]>(
        '/api/v1/job/getall',
        { params }
      )
      .then((r) => {
        const body = r.data;
        if (Array.isArray(body)) return { jobs: body, total: body.length };
        return {
          jobs: (body as { jobs?: JobRequirement[]; data?: JobRequirement[] }).jobs
            ?? (body as { jobs?: JobRequirement[]; data?: JobRequirement[] }).data
            ?? [],
          total: (body as { total?: number }).total ?? 0,
        };
      }),

  getJobById: (id: string) =>
    apiClient
      .get<{ job?: JobRequirement } | JobRequirement>(`/api/v1/job/get/${id}`)
      .then((r) => {
        const body = r.data;
        return (body as { job?: JobRequirement }).job ?? (body as JobRequirement);
      }),

  submitApplication: (payload: SubmitApplicationPayload) =>
    apiClient.post('/api/v1/application/post', payload).then((r) => r.data),

  getMyApplications: (params?: { page?: number; limit?: number }) =>
    apiClient
      .get<{ applications?: Application[]; data?: Application[]; total?: number }>(
        '/api/v1/application/jobseeker/getall',
        { params }
      )
      .then((r) => {
        const body = r.data;
        return {
          applications: body.applications ?? body.data ?? [],
          total: body.total ?? 0,
        };
      }),

  getWorkHistory: (params?: { page?: number; limit?: number }) =>
    apiClient
      .get<{ history?: Application[]; data?: Application[]; total?: number }>(
        '/api/v1/application/getworkhistory',
        { params }
      )
      .then((r) => {
        const body = r.data;
        return {
          history: body.history ?? body.data ?? [],
          total: body.total ?? 0,
        };
      }),

  getHiredWorkers: () =>
    apiClient
      .get<{ workers: PastWorker[] }>('/api/v1/mobile/employer/hired-workers')
      .then((r) => r.data.workers ?? []),
};

export interface PastWorker {
  workerId:     string | null;
  workerName:   string;
  workerPhone:  string;
  lastHireDate: string;
  workType:     string;
  subCategory?: string;
  profilePhoto?: string | null;
  workerStatus?: string | null;
  areasOfWork?:  string[];
}
