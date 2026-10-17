import { Platform } from 'react-native';

const mockCheck = jest.fn();
const mockStart = jest.fn();
jest.mock('expo-in-app-updates', () => ({
  checkForUpdate: (...a: unknown[]) => mockCheck(...a),
  startUpdate: (...a: unknown[]) => mockStart(...a),
}), { virtual: true });

import { isPlayUpdateAvailable, startInAppUpdate } from '../../../features/appUpdate/inAppUpdate';

const setOS = (os: string) => { (Platform as { OS: string }).OS = os; };

describe('inAppUpdate', () => {
  const original = Platform.OS;
  beforeEach(() => { jest.clearAllMocks(); setOS('android'); });
  afterAll(() => setOS(original));

  it('is a no-op (false) off Android', async () => {
    setOS('ios');
    expect(await isPlayUpdateAvailable()).toBe(false);
    expect(await startInAppUpdate(true)).toBe(false);
    expect(mockCheck).not.toHaveBeenCalled();
  });

  it('reports availability from Play', async () => {
    mockCheck.mockResolvedValue({ updateAvailable: true });
    expect(await isPlayUpdateAvailable()).toBe(true);
    mockCheck.mockResolvedValue({ updateAvailable: false });
    expect(await isPlayUpdateAvailable()).toBe(false);
  });

  it('never throws — a Play error resolves to false', async () => {
    mockCheck.mockRejectedValue(new Error('not installed from Play'));
    expect(await isPlayUpdateAvailable()).toBe(false);
    expect(await startInAppUpdate(false)).toBe(false);
  });

  it('does not start when no update is available', async () => {
    mockCheck.mockResolvedValue({ updateAvailable: false });
    expect(await startInAppUpdate(true)).toBe(false);
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('starts an IMMEDIATE flow for the mandatory gate when allowed', async () => {
    mockCheck.mockResolvedValue({ updateAvailable: true, immediateAllowed: true, flexibleAllowed: true });
    mockStart.mockResolvedValue(true);
    expect(await startInAppUpdate(true)).toBe(true);
    expect(mockStart).toHaveBeenCalledWith(true);
  });

  it('starts a FLEXIBLE flow for optional updates, and falls back if only immediate is allowed', async () => {
    mockStart.mockResolvedValue(true);
    mockCheck.mockResolvedValue({ updateAvailable: true, immediateAllowed: true, flexibleAllowed: true });
    await startInAppUpdate(false);
    expect(mockStart).toHaveBeenLastCalledWith(false);
    mockCheck.mockResolvedValue({ updateAvailable: true, immediateAllowed: true, flexibleAllowed: false });
    await startInAppUpdate(false);
    expect(mockStart).toHaveBeenLastCalledWith(true);
  });
});
