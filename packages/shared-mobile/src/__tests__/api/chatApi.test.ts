/**
 * Unit tests for chatApi — messages, send, upload media, unread counts.
 * Covers BackendMessage → ChatMessage mapping logic exhaustively.
 */
import MockAdapter from 'axios-mock-adapter';

jest.mock('../../core/storage/authStorage', () => ({
  getAccessToken: jest.fn().mockResolvedValue(null),
  clearAuthSession: jest.fn(),
}));
jest.mock('../../state/auth/authEventBus', () => ({ emitForceSignOut: jest.fn() }));

import { apiClient } from '../../core/api/client';
import { chatApi } from '../../core/api/endpoints/chatApi';

let mock: MockAdapter;
beforeEach(() => { mock = new MockAdapter(apiClient); });
afterEach(() => { mock.restore(); jest.clearAllMocks(); });

const backendMsg = {
  _id: 'msg-001',
  sender: 'user-001',
  message: 'Hello, is the job still available?',
  timestamp: '2024-01-15T10:00:00.000Z',
  readBy: ['user-001', 'user-002'],
  mediaUrl: null,
  mediaType: null,
  fileName: null,
};

// ── getMessages ───────────────────────────────────────────────────────────────

describe('chatApi.getMessages', () => {
  it('returns mapped messages with default pagination values', async () => {
    mock.onGet('/api/v1/chat/room-001').reply(200, {
      success: true,
      messages: [backendMsg],
      total: 1,
      page: 1,
      pages: 1,
    });
    const res = await chatApi.getMessages('room-001');
    expect(res.messages).toHaveLength(1);
    expect(res.messages[0].id).toBe('msg-001');
    expect(res.messages[0].senderId).toBe('user-001');
    expect(res.messages[0].text).toBe('Hello, is the job still available?');
    expect(res.messages[0].roomId).toBe('room-001');
    expect(res.messages[0].read).toBe(true); // readBy has 2 entries
    expect(res.total).toBe(1);
    expect(res.pages).toBe(1);
  });

  it('generates composite id when _id is missing', async () => {
    const msgNoId = { ...backendMsg, _id: undefined };
    mock.onGet('/api/v1/chat/room-001').reply(200, { success: true, messages: [msgNoId] });
    const res = await chatApi.getMessages('room-001');
    expect(res.messages[0].id).toBe(`${msgNoId.sender}-${msgNoId.timestamp}`);
  });

  it('marks message as unread when readBy is empty', async () => {
    const unread = { ...backendMsg, readBy: [] };
    mock.onGet('/api/v1/chat/room-001').reply(200, { success: true, messages: [unread] });
    const res = await chatApi.getMessages('room-001');
    expect(res.messages[0].read).toBe(false);
  });

  it('maps mediaUrl and mediaType correctly', async () => {
    const mediaMsg = { ...backendMsg, mediaUrl: 'https://s3.example.com/img.jpg', mediaType: 'image' as const, fileName: 'img.jpg' };
    mock.onGet('/api/v1/chat/room-001').reply(200, { success: true, messages: [mediaMsg] });
    const res = await chatApi.getMessages('room-001');
    expect(res.messages[0].mediaUrl).toBe('https://s3.example.com/img.jpg');
    expect(res.messages[0].mediaType).toBe('image');
    expect(res.messages[0].fileName).toBe('img.jpg');
  });

  it('provides fallback values when server omits totals', async () => {
    mock.onGet('/api/v1/chat/room-001').reply(200, { success: true, messages: [] });
    const res = await chatApi.getMessages('room-001', 2, 10);
    expect(res.total).toBe(0);
    expect(res.page).toBe(2);
    expect(res.pages).toBe(1);
  });

  it('handles empty messages array', async () => {
    mock.onGet('/api/v1/chat/room-001').reply(200, { success: true, messages: null, total: 0, page: 1, pages: 0 });
    const res = await chatApi.getMessages('room-001');
    expect(res.messages).toHaveLength(0);
  });

  it('throws on 403 forbidden', async () => {
    mock.onGet('/api/v1/chat/room-001').reply(403, { message: 'Access denied' });
    await expect(chatApi.getMessages('room-001')).rejects.toMatchObject({ statusCode: 403 });
  });
});

// ── sendMessage ───────────────────────────────────────────────────────────────

describe('chatApi.sendMessage', () => {
  it('sends text message and returns response', async () => {
    mock.onPost('/api/v1/chat/room-001').reply(201, { success: true, messageId: 'msg-new' });
    const res = await chatApi.sendMessage('room-001', 'sender-001', 'Hi there');
    expect(res).toEqual({ success: true, messageId: 'msg-new' });
  });

  it('includes media fields when sending an image', async () => {
    let sentBody: Record<string, unknown> = {};
    mock.onPost('/api/v1/chat/room-001').reply((config) => {
      sentBody = JSON.parse(config.data as string);
      return [201, { success: true }];
    });
    await chatApi.sendMessage('room-001', 'user-001', 'Photo', {
      mediaUrl: 'https://s3.example.com/photo.jpg',
      mediaType: 'image',
      fileName: 'photo.jpg',
    });
    expect(sentBody.mediaUrl).toBe('https://s3.example.com/photo.jpg');
    expect(sentBody.mediaType).toBe('image');
  });

  it('throws on network error', async () => {
    mock.onPost('/api/v1/chat/room-001').networkError();
    await expect(chatApi.sendMessage('room-001', 'u1', 'text')).rejects.toBeInstanceOf(Error);
  });
});

// ── uploadMedia ───────────────────────────────────────────────────────────────

describe('chatApi.uploadMedia', () => {
  it('uploads file and returns URL and mediaType', async () => {
    mock.onPost('/api/v1/chat/upload-media').reply(200, {
      url: 'https://s3.example.com/uploads/file.pdf',
      mediaType: 'file',
      fileName: 'file.pdf',
    });
    const res = await chatApi.uploadMedia({
      uri: 'file:///tmp/file.pdf',
      name: 'file.pdf',
      type: 'application/pdf',
    });
    expect(res.url).toBe('https://s3.example.com/uploads/file.pdf');
    expect(res.mediaType).toBe('file');
    expect(res.fileName).toBe('file.pdf');
  });

  it('throws on upload failure', async () => {
    mock.onPost('/api/v1/chat/upload-media').reply(413, { message: 'File too large' });
    await expect(chatApi.uploadMedia({ uri: 'file:///big.jpg', name: 'big.jpg', type: 'image/jpeg' }))
      .rejects.toMatchObject({ statusCode: 413 });
  });
});

// ── getUnreadCounts ───────────────────────────────────────────────────────────

describe('chatApi.getUnreadCounts', () => {
  it('returns unread counts per room', async () => {
    const payload = {
      success: true,
      counts: [
        { postId: 'room-001', unread: 3 },
        { postId: 'room-002', unread: 0 },
      ],
    };
    mock.onGet('/api/v1/chat/unread-counts/user-001').reply(200, payload);
    const res = await chatApi.getUnreadCounts('user-001');
    expect(res.counts).toHaveLength(2);
    expect(res.counts[0].unread).toBe(3);
  });

  it('throws on server error', async () => {
    mock.onGet('/api/v1/chat/unread-counts/u1').reply(500, { message: 'Error' });
    await expect(chatApi.getUnreadCounts('u1')).rejects.toMatchObject({ statusCode: 500 });
  });
});
