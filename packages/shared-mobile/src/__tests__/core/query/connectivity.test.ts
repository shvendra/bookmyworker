import { jest } from '@jest/globals';

// onlineManager.setOnline is the thing React Query actually reacts to —
// mocked so tests can assert on it without spinning up a real QueryClient.
const mockSetOnline = jest.fn();
jest.mock('@tanstack/react-query', () => ({
  onlineManager: { setOnline: mockSetOnline },
}));

describe('connectivity — debounced offline declaration', () => {
  let connectivity: typeof import('../../../core/query/connectivity');
  let mockFetch: jest.Mock<() => Promise<Response>>;
  // react-native is globally mapped to src/__tests__/__mocks__/reactNative.ts.
  // jest.resetModules() below gives connectivity.ts a FRESH module instance
  // (and therefore a fresh mocked AppState) each test — so AppState must be
  // (re-)imported AFTER resetModules, not once at file scope, or this would
  // hold a stale reference that never sees the calls the fresh module makes.
  let AppState: typeof import('react-native').AppState;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.resetModules();
    mockSetOnline.mockClear();
    mockFetch = jest.fn<() => Promise<Response>>(async () => ({ ok: true }) as Response);
    global.fetch = mockFetch as unknown as typeof fetch;
    ({ AppState } = await import('react-native'));
    connectivity = await import('../../../core/query/connectivity');
    connectivity.installConnectivityManager();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts online', () => {
    expect(connectivity.getOnline()).toBe(true);
  });

  it('does NOT go offline immediately on a single reportNetworkDown() — only after the debounce window elapses', () => {
    connectivity.reportNetworkDown();
    expect(connectivity.getOnline()).toBe(true); // still online — brief flicker so far
    expect(mockSetOnline).not.toHaveBeenCalled();

    jest.advanceTimersByTime(9999);
    expect(connectivity.getOnline()).toBe(true); // still within the debounce window

    jest.advanceTimersByTime(1);
    expect(connectivity.getOnline()).toBe(false); // 10s of sustained trouble → now offline
    expect(mockSetOnline).toHaveBeenCalledWith(false);
  });

  it('a brief flicker that recovers before the debounce fires never shows offline at all', () => {
    connectivity.reportNetworkDown();
    jest.advanceTimersByTime(3000); // well within the 10s window
    connectivity.reportNetworkOk();

    jest.advanceTimersByTime(20000); // long past where the original timer would have fired
    expect(connectivity.getOnline()).toBe(true);
    // setOnline(false) must never have been reached.
    expect(mockSetOnline).not.toHaveBeenCalledWith(false);
  });

  it('recovery from a genuinely offline state is instant, not debounced', () => {
    connectivity.reportNetworkDown();
    jest.advanceTimersByTime(10000);
    expect(connectivity.getOnline()).toBe(false);

    connectivity.reportNetworkOk();
    expect(connectivity.getOnline()).toBe(true); // no waiting to come back online
  });

  it('repeated reportNetworkDown() calls within the debounce window do not restart the timer', () => {
    connectivity.reportNetworkDown();
    jest.advanceTimersByTime(6000);
    connectivity.reportNetworkDown(); // a second failure — must not push the deadline out further
    jest.advanceTimersByTime(4000); // total 10s from the FIRST call
    expect(connectivity.getOnline()).toBe(false);
  });

  it('while already offline, reportNetworkDown() is a no-op (no duplicate timers/listener calls)', () => {
    connectivity.reportNetworkDown();
    jest.advanceTimersByTime(10000);
    expect(connectivity.getOnline()).toBe(false);
    mockSetOnline.mockClear();

    connectivity.reportNetworkDown();
    jest.advanceTimersByTime(10000);
    expect(mockSetOnline).not.toHaveBeenCalled(); // nothing changed — still offline, no new transition
  });

  it('subscribeOnline is notified only on the actual (debounced) transition, not on the initial signal', () => {
    const onChange = jest.fn();
    const unsubscribe = connectivity.subscribeOnline(onChange);

    connectivity.reportNetworkDown();
    expect(onChange).not.toHaveBeenCalled();

    jest.advanceTimersByTime(10000);
    expect(onChange).toHaveBeenCalledWith(false);
    unsubscribe();
  });

  it('forceOnlineRecheck() (manual "Try again") is immediate, not debounced — bypasses the flicker guard entirely', async () => {
    mockFetch.mockRejectedValue(new Error('still down'));
    const okPromise = connectivity.forceOnlineRecheck();
    await jest.advanceTimersByTimeAsync(0);
    const ok = await okPromise;
    expect(ok).toBe(false);
    expect(connectivity.getOnline()).toBe(false); // reflects the real probe result right away
  });

  it('AppState resuming to active re-probes and reflects the result immediately (not debounced)', async () => {
    const listenerCall = (AppState.addEventListener as jest.Mock).mock.calls.find(
      (c) => c[0] === 'change',
    );
    expect(listenerCall).toBeTruthy();
    const onChange = listenerCall![1] as (status: string) => void;

    mockFetch.mockRejectedValue(new Error('down'));
    onChange('active');
    await jest.advanceTimersByTimeAsync(0);
    expect(connectivity.getOnline()).toBe(false);
  });
});
