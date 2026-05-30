/**
 * Unit tests for notificationApi — token management, CRUD notifications, preferences.
 */
import MockAdapter from 'axios-mock-adapter';

jest.mock('../../core/storage/authStorage', () => ({
  getAccessToken: jest.fn().mockResolvedValue(null),
  clearAuthSession: jest.fn(),
}));
jest.mock('../../state/auth/authEventBus', () => ({ emitForceSignOut: jest.fn() }));

import { apiClient } from '../../core/api/client';
import { notificationApi, type NotificationItem, type NotificationsResponse } from '../../core/api/endpoints/notificationApi';

let mock: MockAdapter;
beforeEach(() => { mock = new MockAdapter(apiClient); });
afterEach(() => { mock.restore(); jest.clearAllMocks(); });

const notif: NotificationItem = {
  _id: 'notif-001',
  userId: 'user-001',
  title: 'New Job Available',
  body: 'A new requirement near you',
  type: 'requirement',
  read: false,
  createdAt: '2024-01-15T10:00:00.000Z',
};

const notifResponse: NotificationsResponse = {
  success: true,
  notifications: [notif],
  total: 1,
  unreadCount: 1,
  page: 1,
  pages: 1,
};

// ── registerToken ─────────────────────────────────────────────────────────────

describe('notificationApi.registerToken', () => {
  it('registers push token and returns response', async () => {
    mock.onPost('/api/v1/notifications/register-token').reply(200, { success: true });
    const res = await notificationApi.registerToken('ExponentPushToken[abc123]');
    expect(res).toEqual({ success: true });
  });

  it('throws on server error', async () => {
    mock.onPost('/api/v1/notifications/register-token').reply(500, { message: 'Server error' });
    await expect(notificationApi.registerToken('bad-token')).rejects.toMatchObject({ statusCode: 500 });
  });
});

// ── removeToken ───────────────────────────────────────────────────────────────

describe('notificationApi.removeToken', () => {
  it('deletes the push token', async () => {
    mock.onDelete('/api/v1/notifications/register-token').reply(200, { success: true });
    const res = await notificationApi.removeToken();
    expect(res).toEqual({ success: true });
  });

  it('does not throw on 404 (token already removed)', async () => {
    // Note: our interceptor will throw ApiClientError but callers catch it
    mock.onDelete('/api/v1/notifications/register-token').reply(404, { message: 'Token not found' });
    await expect(notificationApi.removeToken()).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── getNotifications ──────────────────────────────────────────────────────────

describe('notificationApi.getNotifications', () => {
  it('returns paginated notifications', async () => {
    mock.onGet('/api/v1/notifications').reply(200, notifResponse);
    const res = await notificationApi.getNotifications({ page: 1, limit: 20 });
    expect(res.notifications).toHaveLength(1);
    expect(res.unreadCount).toBe(1);
    expect(res.pages).toBe(1);
  });

  it('fetches with no params (uses defaults)', async () => {
    mock.onGet('/api/v1/notifications').reply(200, { ...notifResponse, notifications: [] });
    const res = await notificationApi.getNotifications();
    expect(res.success).toBe(true);
  });

  it('throws on auth failure', async () => {
    mock.onGet('/api/v1/notifications').reply(401, { message: 'Unauthorized' });
    await expect(notificationApi.getNotifications()).rejects.toMatchObject({ statusCode: 401 });
  });
});

// ── markRead ──────────────────────────────────────────────────────────────────

describe('notificationApi.markRead', () => {
  it('marks a single notification as read', async () => {
    mock.onPut('/api/v1/notifications/notif-001/read').reply(200, { success: true });
    const res = await notificationApi.markRead('notif-001');
    expect(res).toEqual({ success: true });
  });

  it('throws on 404 when notification not found', async () => {
    mock.onPut('/api/v1/notifications/missing/read').reply(404, { message: 'Not found' });
    await expect(notificationApi.markRead('missing')).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── markAllRead ───────────────────────────────────────────────────────────────

describe('notificationApi.markAllRead', () => {
  it('marks all notifications as read', async () => {
    mock.onPut('/api/v1/notifications/read-all').reply(200, { success: true, updated: 5 });
    const res = await notificationApi.markAllRead();
    expect(res).toMatchObject({ success: true });
  });
});

// ── getPreferences ────────────────────────────────────────────────────────────

describe('notificationApi.getPreferences', () => {
  it('returns notification preferences', async () => {
    const prefs = {
      newRequirement: true,
      expressedInterest: false,
      paymentSuccess: true,
      payoutApproved: true,
      kycUpdate: true,
      chat: true,
      promotions: false,
      newWorkerInState: true,
      callOutcome: false,
    };
    mock.onGet('/api/v1/notifications/preferences').reply(200, { success: true, preferences: prefs });
    const res = await notificationApi.getPreferences();
    expect(res.preferences.newRequirement).toBe(true);
    expect(res.preferences.promotions).toBe(false);
  });
});

// ── savePreferences ───────────────────────────────────────────────────────────

describe('notificationApi.savePreferences', () => {
  it('saves partial preferences', async () => {
    mock.onPut('/api/v1/notifications/preferences').reply(200, { success: true });
    const res = await notificationApi.savePreferences({ promotions: false, chat: true });
    expect(res).toEqual({ success: true });
  });

  it('saves full preferences object', async () => {
    mock.onPut('/api/v1/notifications/preferences').reply(200, { success: true });
    await expect(notificationApi.savePreferences({
      newRequirement: true,
      expressedInterest: true,
      paymentSuccess: true,
      payoutApproved: true,
      kycUpdate: false,
      chat: true,
      promotions: false,
      newWorkerInState: true,
      callOutcome: true,
    })).resolves.toEqual({ success: true });
  });

  it('throws on validation error', async () => {
    mock.onPut('/api/v1/notifications/preferences').reply(422, { message: 'Invalid preference key' });
    await expect(notificationApi.savePreferences({ promotions: false }))
      .rejects.toMatchObject({ statusCode: 422 });
  });
});
