/**
 * Compare two dot-separated numeric version strings.
 *   compareVersions("1.0.9", "1.0.10")  -> -1   (a older)
 *   compareVersions("12.3.52", "12.3.5") ->  1   (a newer)
 *   compareVersions("1.0.45", "1.0.45")  ->  0
 *
 * Non-numeric / missing segments are treated as 0, so a malformed value can
 * never throw — it just compares as an older/equal version and the gate stays
 * conservative.
 */
export function compareVersions(a: string, b: string): number {
  const pa = String(a).split('.').map((x) => parseInt(x, 10) || 0);
  const pb = String(b).split('.').map((x) => parseInt(x, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return 0;
}
