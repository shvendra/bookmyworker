import { apiClient } from '../client';

export interface ContactViewItem {
  _id: string;
  workerId: string;
  workerName: string;
  workerPhone: string;
  workerRole: string;
  viewCount: number;
  firstViewedAt: string;
  lastViewedAt: string;
  countedAgainstQuota: boolean;
  source: 'unlock' | 'hired';
}

export interface MyContactViewsResponse {
  success: boolean;
  items: ContactViewItem[];
  total: number;
  page: number;
  totalPages: number;
  summary: {
    totalUnique: number;
    chargedUnique: number;
    remainingContacts: number | null;
  };
}

export const contactViewsApi = {
  // Employer: worker contacts they have viewed (unique workers, newest first)
  getMyViews: async (page = 1, limit = 100): Promise<MyContactViewsResponse> => {
    const res = await apiClient.get<MyContactViewsResponse>('/api/v1/contact-views/my', {
      params: { page, limit },
    });
    return res.data;
  },
};
