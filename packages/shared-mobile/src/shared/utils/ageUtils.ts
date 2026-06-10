/**
 * Age helpers — mirror of the backend `utils/ageUtils.js`.
 *
 * `dob` may be stored as a birth YEAR ("1998"), a legacy frozen AGE ("28"),
 * a full date, or a unix timestamp. `computeAge` derives the CURRENT age so it
 * grows every year ("register age + years elapsed").
 */
export const computeAge = (dob?: string | number | null, now: Date = new Date()): number | '' => {
  if (dob === null || dob === undefined || dob === '') return '';

  const today = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  const raw = String(dob).trim();
  const num = Number(dob);

  // Short numeric → a birth year (preferred) or a legacy frozen age.
  if (!Number.isNaN(num) && raw.length <= 5 && /^\d+$/.test(raw)) {
    if (num > 1900 && num <= today.getFullYear()) return today.getFullYear() - num;
    return num;
  }

  // Full date or timestamp.
  let ms = num;
  if (Number.isNaN(ms)) {
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return '';
    ms = parsed.getTime();
  } else if (ms < 10000000000) {
    ms *= 1000;
  }

  const birth = new Date(ms);
  if (Number.isNaN(birth.getTime())) return '';

  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age < 0 ? '' : age;
};

/** Convenience: computeAge as a display string ("" when unknown). */
export const ageString = (dob?: string | number | null, now?: Date): string => {
  const a = computeAge(dob, now);
  return a === '' ? '' : String(a);
};
