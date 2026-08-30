import { compareVersions } from '../../../features/appUpdate/compareVersions';

describe('compareVersions', () => {
  it('orders numeric segments, not lexically', () => {
    expect(compareVersions('1.0.9', '1.0.10')).toBe(-1);
    expect(compareVersions('1.0.10', '1.0.9')).toBe(1);
    expect(compareVersions('12.3.5', '12.3.52')).toBe(-1);
  });

  it('treats equal versions as 0, ignoring trailing zeros', () => {
    expect(compareVersions('1.0.45', '1.0.45')).toBe(0);
    expect(compareVersions('1.0', '1.0.0')).toBe(0);
  });

  it('handles different segment counts', () => {
    expect(compareVersions('1.2', '1.2.1')).toBe(-1);
    expect(compareVersions('2', '1.9.9')).toBe(1);
  });

  it('malformed input never throws — missing/NaN segments read as 0', () => {
    expect(compareVersions('', '1.0.0')).toBe(-1);
    expect(compareVersions('1.x.3', '1.0.3')).toBe(0);
    expect(compareVersions('abc', 'def')).toBe(0);
  });

  it('real gate cases: old employer / agent builds are behind', () => {
    expect(compareVersions('1.0.37', '1.0.45') < 0).toBe(true);   // employer old vs latest
    expect(compareVersions('12.3.46', '12.3.52') < 0).toBe(true); // agent old vs latest
    expect(compareVersions('1.0.45', '1.0.45') < 0).toBe(false);  // on latest → not gated
  });
});
