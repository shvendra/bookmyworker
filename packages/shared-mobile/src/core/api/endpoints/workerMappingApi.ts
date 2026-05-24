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

  // Advance a mapping's status
  updateMappingStatus: (mappingId: string, status: MappingStatus) =>
    apiClient
      .put<{ success: boolean; message: string; mapping: WorkerMapping }>(
        `/api/v1/mapping/${mappingId}/status`,
        { status }
      )
      .then((r) => r.data),

  // Un-shortlist (only works if status is Shortlisted)
  removeShortlist: (mappingId: string) =>
    apiClient
      .delete<{ success: boolean; message: string }>(`/api/v1/mapping/${mappingId}`)
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
