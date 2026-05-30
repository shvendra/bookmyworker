import { apiClient } from '../client';

export type PlacementStatus = 'active' | 'completed' | 'disputed';

export interface Placement {
  _id: string;
  mappingId: string;
  requirementId: string;
  ernNumber?: string;
  workType?: string;
  workLocation?: string;
  district?: string;
  state?: string;
  employerId: string;
  employerName?: string;
  employerPhone?: string;
  agentId?: string;
  agentName?: string;
  agentPhone?: string;
  workerId?: string | null;
  workerName: string;
  workerPhone?: string;
  workerSkill?: string;
  agreedRate: number;
  rateType: 'Daily' | 'Monthly';
  joinedDate: string;
  status: PlacementStatus;
  completedDate?: string | null;
  proofFileUrl?: string | null;
  proofNote?: string | null;
  adminNote?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlacementStats {
  totalPlacements: number;
  activePlacements: number;
  completedPlacements: number;
}

export interface MyPlacementsResponse {
  success: boolean;
  placements: Placement[];
  total: number;
  page: number;
  totalPages: number;
  stats: PlacementStats;
}

export const placementApi = {
  // Agent: fetch their placements + stats
  getMyPlacements: (params?: { status?: PlacementStatus; page?: number; limit?: number }) =>
    apiClient
      .get<MyPlacementsResponse>('/api/v1/placements/my', { params })
      .then((r) => r.data),

  // Agent: mark a placement as completed
  markCompleted: (placementId: string) =>
    apiClient
      .patch<{ success: boolean; placement: Placement }>(
        `/api/v1/placements/${placementId}/status`,
        { status: 'completed' },
      )
      .then((r) => r.data),

  // Agent: upload proof document
  uploadProof: (placementId: string, fileUri: string, fileName: string, mimeType: string, note?: string) => {
    const form = new FormData();
    form.append('proof', { uri: fileUri, name: fileName, type: mimeType } as unknown as Blob);
    if (note) form.append('note', note);
    return apiClient
      .post<{ success: boolean; proofFileUrl: string; placement: Placement }>(
        `/api/v1/placements/${placementId}/proof`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      .then((r) => r.data);
  },
};
