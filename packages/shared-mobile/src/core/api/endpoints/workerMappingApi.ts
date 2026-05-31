import { apiClient } from '../client';
import type { RawRequirement } from './requirementsApi';

export type MappingStatus = 'Shortlisted' | 'Selected' | 'Joined';

export interface WorkerMapping {
  _id: string;
  requirementId: string | RawRequirement;
  workerId?: string | null;
  workerName: string;
  workerPhone: string;
  workerSkill?: string;
  employerId: string;
  status: MappingStatus;
  agreedRate?: number | null;
  rateType?: 'Daily' | 'Monthly' | null;
  joinedDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MapWorkerPayload {
  workerId?: string | null;
  workerName: string;
  workerPhone: string;
  workerSkill?: string;
  requirementIds: string[];
  status: MappingStatus;
  agreedRate?: number;   // required when status === 'Joined'
  rateType?: 'Daily' | 'Monthly'; // required when status === 'Joined'
}

export interface OpenRequirement {
  _id: string;
  workType?: string;
  subCategory?: string;
  ERN_NUMBER?: number;
  district?: string;
  state?: string;
  workerQuantitySkilled?: number;
  status?: string;
}

export const workerMappingApi = {
  // Map a worker to one or more requirements
  mapWorker: (payload: MapWorkerPayload) =>
    apiClient
      .post<{ success: boolean; message: string; mapped: WorkerMapping[]; errors: unknown[] }>(
        '/api/v1/mapping/map',
        payload
      )
      .then((r) => r.data),

  // Get employer's open requirements (for the selection popup)
  getEmployerOpenRequirements: () =>
    apiClient
      .get<{ success: boolean; requirements: OpenRequirement[] }>(
        '/api/v1/mapping/employer/requirements'
      )
      .then((r) => r.data.requirements ?? []),

  // Get pipeline mappings for a single requirement
  getRequirementMappings: (requirementId: string) =>
    apiClient
      .get<{
        success: boolean;
        mappings: WorkerMapping[];
        grouped: { Shortlisted: WorkerMapping[]; Selected: WorkerMapping[]; Joined: WorkerMapping[] };
      }>(`/api/v1/mapping/requirement/${requirementId}`)
      .then((r) => r.data),

  // Advance a mapping's status — agreedRate + rateType required when status === 'Joined'
  updateMappingStatus: (
    mappingId: string,
    status: MappingStatus,
    hireRate?: { agreedRate: number; rateType: 'Daily' | 'Monthly' }
  ) =>
    apiClient
      .put<{ success: boolean; message: string; mapping: WorkerMapping }>(
        `/api/v1/mapping/${mappingId}/status`,
        { status, ...hireRate }
      )
      .then((r) => r.data),

  // Un-shortlist (only works if status is Shortlisted)
  removeShortlist: (mappingId: string) =>
    apiClient
      .delete<{ success: boolean; message: string }>(`/api/v1/mapping/${mappingId}`)
      .then((r) => r.data),

  // Revert one pipeline step: Joined → Selected, Selected → Shortlisted
  revertMappingStatus: (mappingId: string) =>
    apiClient
      .put<{ success: boolean; message: string; mapping: WorkerMapping }>(
        `/api/v1/mapping/${mappingId}/revert`
      )
      .then((r) => r.data),

  // Full pipeline overview for employer (totals + per-requirement worker lists)
  getEmployerPipelineOverview: () =>
    apiClient
      .get<{
        success: boolean;
        totals: { Shortlisted: number; Selected: number; Joined: number };
        requirements: Array<{
          requirement: OpenRequirement & { status?: string };
          counts: { Shortlisted: number; Selected: number; Joined: number };
          workers: WorkerMapping[];
        }>;
      }>('/api/v1/mapping/employer/pipeline-overview')
      .then((r) => r.data),
};
