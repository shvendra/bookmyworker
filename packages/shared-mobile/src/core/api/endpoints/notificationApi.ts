import { apiClient } from '../client';

export interface NotificationItem {
  _id: string;
  userId: string;
  title: string;
  body: string;
  type: 'requirement' | 'interest' | 'payment' | 'payout' | 'kyc' | 'chat' | 'system' | 'newWorker';
  data?: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  success: boolean;
  notifications: NotificationItem[];
  total: number;
  unreadCount: number;
  page: number;
  pages: number;
}

export interface NotificationPreferences {
  newRequirement: boolean;
  expressedInterest: boolean;
  paymentSuccess: boolean;
  payoutApproved: boolean;
  kycUpdate: boolean;
  chat: boolean;
  promotions: boolean;
  newWorkerInState: boolean;
  callOutcome: boolean;
}

export const notificationApi = {
  registerToken: (pushToken: string) =>
    apiClient.post('/api/v1/notifications/register-token', { pushToken }).then((r) => r.data),

  removeToken: () =>
    apiClient.delete('/api/v1/notifications/register-token').then((r) => r.data),

  getNotifications: (params?: { page?: number; limit?: number }): Promise<NotificationsResponse> =>
    apiClient.get('/api/v1/notifications', { params }).then((r) => r.data as NotificationsResponse),

  markRead: (id: string) =>
    apiClient.put(`/api/v1/notifications/${id}/read`).then((r) => r.data),

  markAllRead: () =>
    apiClient.put('/api/v1/notifications/read-all').then((r) => r.data),

  getPreferences: (): Promise<{ success: boolean; preferences: NotificationPreferences }> =>
    apiClient.get('/api/v1/notifications/preferences').then((r) => r.data as { success: boolean; preferences: NotificationPreferences }),

  savePreferences: (prefs: Partial<NotificationPreferences>) =>
    apiClient.put('/api/v1/notifications/preferences', prefs).then((r) => r.data),
};
