import { shouldShowUpdateStrip } from '../../../features/appUpdate/dismissStore';

const base = { status: 'optional', latestVersion: '1.0.74', dismissedVersion: '', closedNow: false };

describe('shouldShowUpdateStrip', () => {
  it('shows for an optional update that was never closed', () => {
    expect(shouldShowUpdateStrip(base)).toBe(true);
  });
  it('stays hidden once closed for this exact version — also after an app restart', () => {
    expect(shouldShowUpdateStrip({ ...base, dismissedVersion: '1.0.74' })).toBe(false);
    expect(shouldShowUpdateStrip({ ...base, closedNow: true })).toBe(false);
  });
  it('comes back when a NEWER version is released', () => {
    expect(shouldShowUpdateStrip({ ...base, latestVersion: '1.0.75', dismissedVersion: '1.0.74' })).toBe(true);
  });
  it('never flashes while storage is still being read, and never shows for ok / required', () => {
    expect(shouldShowUpdateStrip({ ...base, dismissedVersion: null })).toBe(false);
    expect(shouldShowUpdateStrip({ ...base, status: 'ok' })).toBe(false);
    expect(shouldShowUpdateStrip({ ...base, status: 'required' })).toBe(false);
  });
});

import { shouldShowUpdateDialog, DIALOG_GAP_MS } from '../../../features/appUpdate/dismissStore';

describe('shouldShowUpdateDialog', () => {
  const now = 1_700_000_000_000;
  const base = { status: 'optional', authenticated: true, latestVersion: '1.0.74', memory: { version: '', at: 0 }, now, shownThisRun: false };
  it('shows after sign-in for an update never shown before', () => {
    expect(shouldShowUpdateDialog(base)).toBe(true);
  });
  it('does not show before sign-in, for ok / required, or while storage is still loading', () => {
    expect(shouldShowUpdateDialog({ ...base, authenticated: false })).toBe(false);
    expect(shouldShowUpdateDialog({ ...base, status: 'ok' })).toBe(false);
    expect(shouldShowUpdateDialog({ ...base, status: 'required' })).toBe(false);
    expect(shouldShowUpdateDialog({ ...base, memory: null })).toBe(false);
  });
  it('after "Later" stays away for a day for the same version, then asks again', () => {
    const seen = { version: '1.0.74', at: now - 1000 };
    expect(shouldShowUpdateDialog({ ...base, memory: seen })).toBe(false);
    expect(shouldShowUpdateDialog({ ...base, memory: { ...seen, at: now - DIALOG_GAP_MS - 1 } })).toBe(true);
  });
  it('shows at once for a NEWER version, and only once per app run', () => {
    expect(shouldShowUpdateDialog({ ...base, memory: { version: '1.0.73', at: now - 1000 } })).toBe(true);
    expect(shouldShowUpdateDialog({ ...base, shownThisRun: true })).toBe(false);
  });
});
