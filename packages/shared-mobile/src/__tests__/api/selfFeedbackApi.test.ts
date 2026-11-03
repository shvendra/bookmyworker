/** Quarterly employer feedback — API client + the popup timer. */
import MockAdapter from 'axios-mock-adapter';

jest.mock('../../core/storage/authStorage', () => ({
  getAccessToken: jest.fn().mockResolvedValue(null),
  clearAuthSession: jest.fn(),
}));
jest.mock('../../state/auth/authEventBus', () => ({ emitForceSignOut: jest.fn() }));

import { apiClient } from '../../core/api/client';
import { selfFeedbackApi } from '../../core/api/endpoints/selfFeedbackApi';
import { scheduleFeedbackNudge, resetFeedbackNudgeForTests } from '../../features/employer/utils/useFeedbackNudge';
import { emptyDraft, toSubmitBody } from '../../features/employer/utils/feedbackForm';

let mock: MockAdapter;
beforeEach(() => { mock = new MockAdapter(apiClient); resetFeedbackNudgeForTests(); jest.useFakeTimers(); });
afterEach(() => { mock.restore(); jest.useRealTimers(); jest.clearAllMocks(); });

describe('selfFeedbackApi', () => {
  it('reads the status', async () => {
    mock.onGet('/api/v1/employer-self-feedback/status').reply(200, { activePlan: true, due: true, canSubmit: true });
    expect(await selfFeedbackApi.status()).toEqual({ activePlan: true, due: true, canSubmit: true });
  });
  it('submits with platform "app" and reports the follow-up flag', async () => {
    let sent: Record<string, unknown> = {};
    mock.onPost('/api/v1/employer-self-feedback/submit').reply((c) => { sent = JSON.parse(c.data); return [200, { success: true, needsFollowUp: true }]; });
    const r = await selfFeedbackApi.submit(toSubmitBody({ ...emptyDraft(), overall: 1 }));
    expect(r).toEqual({ needsFollowUp: true });
    expect(sent).toMatchObject({ overall: 1, platform: 'app' });
  });
  it('a duplicate answer (already given this quarter) is accepted quietly', async () => {
    mock.onPost('/api/v1/employer-self-feedback/submit').reply(200, { success: true, duplicate: true });
    expect(await selfFeedbackApi.submit(toSubmitBody({ ...emptyDraft(), overall: 5 }))).toEqual({ needsFollowUp: false });
  });
  it('surfaces the server message when the plan has ended', async () => {
    mock.onPost('/api/v1/employer-self-feedback/submit').reply(403, { message: 'Feedback is available while your plan is active.' });
    await expect(selfFeedbackApi.submit(toSubmitBody({ ...emptyDraft(), overall: 5 }))).rejects.toThrow(/plan is active/);
  });
  it('"maybe later" posts a dismiss', async () => {
    mock.onPost('/api/v1/employer-self-feedback/dismiss').reply(200, { success: true });
    await expect(selfFeedbackApi.dismiss()).resolves.toBeUndefined();
    expect(mock.history.post).toHaveLength(1);
  });
});

describe('scheduleFeedbackNudge', () => {
  const flush = async (): Promise<void> => { for (let i = 0; i < 5; i++) await Promise.resolve(); };

  it('opens the form once the wait is over and the server says they are due', async () => {
    mock.onGet('/api/v1/employer-self-feedback/status').reply(200, { activePlan: true, due: true });
    const open = jest.fn();
    scheduleFeedbackNudge(open, 60);
    jest.advanceTimersByTime(59_000);
    expect(mock.history.get).toHaveLength(0);
    jest.advanceTimersByTime(1_000);
    jest.useRealTimers(); await new Promise((r) => setTimeout(r, 20));
    expect(open).toHaveBeenCalledTimes(1);
  });
  it('does not open when they are not due', async () => {
    mock.onGet('/api/v1/employer-self-feedback/status').reply(200, { activePlan: true, due: false });
    const open = jest.fn();
    scheduleFeedbackNudge(open, 1);
    jest.advanceTimersByTime(1_000);
    jest.useRealTimers(); await new Promise((r) => setTimeout(r, 20));
    expect(open).not.toHaveBeenCalled();
  });
  it('stays quiet when the check fails', async () => {
    mock.onGet('/api/v1/employer-self-feedback/status').networkError();
    const open = jest.fn();
    scheduleFeedbackNudge(open, 1);
    jest.advanceTimersByTime(1_000);
    jest.useRealTimers(); await new Promise((r) => setTimeout(r, 20));
    expect(open).not.toHaveBeenCalled();
  });
  it('can be cancelled (screen left / plan lapsed) before it fires', () => {
    mock.onGet('/api/v1/employer-self-feedback/status').reply(200, { due: true });
    const cancel = scheduleFeedbackNudge(jest.fn(), 60);
    cancel();
    jest.advanceTimersByTime(120_000);
    expect(mock.history.get).toHaveLength(0);
  });
  it('asks at most once per app launch', async () => {
    mock.onGet('/api/v1/employer-self-feedback/status').reply(200, { due: false });
    scheduleFeedbackNudge(jest.fn(), 1);
    jest.advanceTimersByTime(1_000);
    await flush();
    const again = jest.fn();
    scheduleFeedbackNudge(again, 1);
    jest.advanceTimersByTime(5_000);
    await flush();
    expect(mock.history.get).toHaveLength(1);
  });
});
