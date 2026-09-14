import { apiClient } from '../client';

// ── Types ─────────────────────────────────────────────────────────────────────
// Mirrors backend/models/WorkforceWorkType.js, WorkforceSubWorkType.js,
// WorkforceSkillTag.js. See backend/controllers/workforceMasterDataController.js.
//
// SCOPE: only the three Employer-readable catalog resources (Work Types, Sub
// Work Types, Skill Tags — gated by `canReadWorkforceCatalog`). Rate
// Bands/Allowance/Deduction/Overtime types are CRM-internal only and have no
// functions here by design.

export type MasterDataStatus = 'Active' | 'Inactive';

export interface WorkforceWorkType {
  _id: string;
  name: string;
  description?: string;
  sortOrder?: number;
  status: MasterDataStatus;
}

export interface WorkforceSubWorkType {
  _id: string;
  workTypeId: string;
  workTypeName?: string;
  name: string;
  description?: string;
  defaultSkillTags?: string[];
  status: MasterDataStatus;
}

export interface WorkforceSkillTag {
  _id: string;
  name: string;
  category?: string;
  status: MasterDataStatus;
}

// ── API methods ───────────────────────────────────────────────────────────────

export const workforceMasterApi = {
  // An Employer caller only ever sees Active entries — the backend forces
  // this filter server-side regardless of any query param.
  getWorkTypes: () =>
    apiClient
      .get<{ success: boolean; items: WorkforceWorkType[] }>('/api/v1/workforce/work-types')
      .then((r) => r.data.items ?? []),

  getSubWorkTypes: (workTypeId?: string) =>
    apiClient
      .get<{ success: boolean; items: WorkforceSubWorkType[] }>('/api/v1/workforce/sub-work-types', {
        params: workTypeId ? { workTypeId } : undefined,
      })
      .then((r) => r.data.items ?? []),

  getSkillTags: () =>
    apiClient
      .get<{ success: boolean; items: WorkforceSkillTag[] }>('/api/v1/workforce/skill-tags')
      .then((r) => r.data.items ?? []),
};
