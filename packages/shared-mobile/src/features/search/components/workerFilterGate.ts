/** Pure helper (no RN / i18n imports) so it is unit-testable. */
interface GateFilters {
  state?: string; district?: string; tehsil?: string;
  workerType?: string; subCategory?: string; gender?: string; workerGroup?: string;
  ageMin?: string; ageMax?: string; qualification?: string; hasResume?: unknown;
}

/** Filters other than location (state / district / block). Location browsing is free for everyone; these need a plan. */
export function countNonLocationActive(f: GateFilters): number {
  return [f.workerType, f.subCategory, f.gender, f.workerGroup, f.ageMin, f.ageMax, f.qualification, f.hasResume].filter(Boolean).length;
}

const norm = (v?: string): string => String(v ?? '').trim().toLowerCase();

/**
 * Mirrors the backend contact-scope rule (utils/workerScope.js): is this worker OUTSIDE the area the employer's plan lets them
 * CONTACT? Browsing is never limited. Informational only — the server still decides on unlock. Fail-open without a saved location.
 */
export function isOutsidePlanScope(
  scope: string | undefined,
  employer: { state?: string; district?: string },
  worker: { state?: string; district?: string },
): boolean {
  if (!scope || scope === 'india') return false;
  const es = norm(employer.state);
  const ed = norm(employer.district);
  if (es && norm(worker.state) !== es) return true;
  if (scope === 'district' && ed) {
    const wd = norm(worker.district);
    if (!wd || !(wd === ed || wd.includes(ed) || ed.includes(wd))) return true;
  }
  return false;
}
