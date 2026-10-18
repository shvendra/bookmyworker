export interface OtpInputResult {
  digits: string[];
  /** Box that should receive focus next. */
  focusIndex: number;
  /** All boxes filled — the caller may submit. */
  complete: boolean;
}

/**
 * Applies what the user typed / pasted / auto-filled into box `index` of a segmented OTP input.
 *
 * - one digit → set that box and move on (the classic typing flow);
 * - empty → clear the box;
 * - several digits (keyboard "123456" suggestion, paste, autofill) → spread them across the boxes; a full
 *   code always lands from the first box, a short one starts at the box it was entered in.
 * Non-digits are ignored, so a code like "123 456" or "OTP 123456" still works.
 */
export function applyOtpInput(current: readonly string[], index: number, raw: string, length: number): OtpInputResult {
  const next = Array.from({ length }, (_, i) => current[i] ?? '');
  let clean = String(raw ?? '').replace(/\D/g, '');

  // Typing over a filled box without it being selected yields the old digit + the new one: keep the new one.
  if (clean.length === 2 && next[index]) clean = clean[0] === next[index] ? clean[1] : clean[0];

  if (clean.length === 0) {
    next[index] = '';
    return { digits: next, focusIndex: index, complete: false };
  }
  if (clean.length === 1) {
    next[index] = clean;
    return { digits: next, focusIndex: Math.min(index + 1, length - 1), complete: next.every(Boolean) };
  }
  const code = clean.slice(0, length);
  const start = clean.length >= length ? 0 : Math.min(index, length - 1);
  for (let k = 0; k < code.length && start + k < length; k++) next[start + k] = code[k];
  const end = Math.min(start + code.length, length) - 1;
  return { digits: next, focusIndex: Math.min(end + 1, length - 1), complete: next.every(Boolean) };
}
