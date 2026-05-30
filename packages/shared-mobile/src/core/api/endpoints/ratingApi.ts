import { apiClient } from '../client';

export interface WorkerRating {
  _id:           string;
  workerId:      string;
  employerId:    string;
  requirementId: string;
  stars:         number;
  comment?:      string;
  workType?:     string;
  employerName?: string;
  createdAt:     string;
}

export interface RatingStats {
  avgRating:    number;
  totalRatings: number;
}

export const ratingApi = {
  // Employer rates a worker (1–5 stars + optional comment)
  rateWorker: (payload: {
    workerId:      string;
    requirementId: string;
    stars:         number;
    comment?:      string;
  }) =>
    apiClient
      .post<{ success: boolean; message: string; avgRating: number; totalRatings: number }>(
        '/api/v1/ratings/worker',
        payload,
      )
      .then((r) => r.data),

  // Get all ratings for a worker
  getWorkerRatings: (workerId: string, page = 1, limit = 10) =>
    apiClient
      .get<{
        success: boolean;
        ratings: WorkerRating[];
        pagination: { totalCount: number; currentPage: number; totalPages: number; limit: number };
        avgRating:    number;
        totalRatings: number;
      }>(`/api/v1/ratings/worker/${workerId}`, { params: { page, limit } })
      .then((r) => ({
        ratings:      r.data.ratings ?? [],
        pagination:   r.data.pagination,
        avgRating:    r.data.avgRating,
        totalRatings: r.data.totalRatings,
      })),

  // Get which workers from a specific requirement have already been rated by the employer
  getRatedWorkers: (requirementId: string) =>
    apiClient
      .get<{ success: boolean; ratings: Pick<WorkerRating, '_id' | 'workerId' | 'stars' | 'comment' | 'createdAt'>[] }>(
        `/api/v1/ratings/requirement/${requirementId}/workers`,
      )
      .then((r) => r.data.ratings ?? []),
};
