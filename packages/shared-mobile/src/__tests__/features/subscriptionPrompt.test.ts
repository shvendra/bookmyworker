const mockShowAlert = jest.fn();
const mockNavigate = jest.fn();
let mockReady = true;
jest.mock('../../shared/state/alert/AppAlertContext', () => ({ showAlert: (...a: unknown[]) => mockShowAlert(...a) }));
jest.mock('../../core/navigation/navigationRef', () => ({
  navigationRef: { isReady: () => mockReady, navigate: (...a: unknown[]) => mockNavigate(...a) },
}));

import { classifySubscriptionError, promptSubscription } from '../../features/payment/subscriptionPrompt';

const t = ((k: string) => k) as never;

describe('classifySubscriptionError', () => {
  it('maps backend codes (top-level or response.data)', () => {
    expect(classifySubscriptionError({ code: 'SUBSCRIPTION_EXPIRED' })).toBe('expired');
    expect(classifySubscriptionError({ response: { data: { code: 'SUBSCRIPTION_REQUIRED' } } })).toBe('required');
    expect(classifySubscriptionError({ code: 'CONTACT_LIMIT' })).toBe('limit');
  });

  it('maps the invite plan-gate 403 (no code) to "plan"', () => {
    expect(classifySubscriptionError({ statusCode: 403, message: 'Direct Worker Invite is not included in your current plan. Upgrade to Contractor...' })).toBe('plan');
  });

  it('maps plain 403 subscription messages', () => {
    expect(classifySubscriptionError({ statusCode: 403, message: 'Your subscription has expired' })).toBe('expired');
    expect(classifySubscriptionError({ statusCode: 403, message: 'Please subscribe to continue' })).toBe('required');
  });

  it('returns null for unrelated errors so callers keep their own handling', () => {
    expect(classifySubscriptionError({ statusCode: 500, message: 'boom' })).toBeNull();
    expect(classifySubscriptionError({ statusCode: 409, message: 'already invited' })).toBeNull();
    expect(classifySubscriptionError(null)).toBeNull();
    expect(classifySubscriptionError(new Error('Network'))).toBeNull();
  });
});

describe('promptSubscription', () => {
  beforeEach(() => { jest.clearAllMocks(); mockReady = true; });

  it.each([
    ['required', 'sub_noneTitle', 'sub_noneMsg', 'sub_btnSubscribe'],
    ['expired', 'sub_expiredTitle', 'sub_expiredMsg', 'sub_btnRenew'],
    ['limit', 'sub_limitTitle', 'sub_limitMsg', 'sub_btnTopup'],
    ['plan', 'sub_planTitle', 'sub_planMsg', 'sub_btnUpgrade'],
  ] as const)('%s → consistent dialog with Cancel + action', (issue, title, msg, btn) => {
    promptSubscription(issue, t);
    const [gotTitle, gotMsg, buttons] = mockShowAlert.mock.calls[0];
    expect([gotTitle, gotMsg]).toEqual([title, msg]);
    expect(buttons[0]).toMatchObject({ text: 'wp_cancel', style: 'cancel' });
    expect(buttons[1].text).toBe(btn);
  });

  it('the action button runs the pre-navigate hook then opens Subscription', () => {
    const before = jest.fn();
    promptSubscription('expired', t, before);
    mockShowAlert.mock.calls[0][2][1].onPress();
    expect(before).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('Subscription');
  });

  it('still navigates if the pre-navigate hook throws; no-op when nav not ready', () => {
    promptSubscription('required', t, () => { throw new Error('x'); });
    mockShowAlert.mock.calls[0][2][1].onPress();
    expect(mockNavigate).toHaveBeenCalledWith('Subscription');
    mockNavigate.mockClear(); mockReady = false;
    mockShowAlert.mock.calls[0][2][1].onPress();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('cancel does not navigate', () => {
    promptSubscription('required', t);
    expect(mockShowAlert.mock.calls[0][2][0].onPress).toBeUndefined();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
