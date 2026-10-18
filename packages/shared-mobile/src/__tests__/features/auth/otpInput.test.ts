import { applyOtpInput } from '../../../features/auth/utils/otpInput';

const empty = Array(6).fill('');

describe('applyOtpInput — segmented OTP box', () => {
  it('typing one digit fills the box and moves to the next', () => {
    const r = applyOtpInput(empty, 0, '4', 6);
    expect(r.digits).toEqual(['4', '', '', '', '', '']);
    expect(r.focusIndex).toBe(1);
    expect(r.complete).toBe(false);
  });
  it('typing the last digit completes the code', () => {
    const r = applyOtpInput(['1', '2', '3', '4', '5', ''], 5, '6', 6);
    expect(r.complete).toBe(true);
    expect(r.digits.join('')).toBe('123456');
    expect(r.focusIndex).toBe(5);
  });
  it('a full code pasted / auto-filled into ANY box lands from the first box and completes', () => {
    for (const idx of [0, 2, 5]) {
      const r = applyOtpInput(empty, idx, '123456', 6);
      expect(r.digits.join('')).toBe('123456');
      expect(r.complete).toBe(true);
    }
  });
  it('ignores non-digits (spaces, text around the code)', () => {
    expect(applyOtpInput(empty, 0, '123 456', 6).digits.join('')).toBe('123456');
    expect(applyOtpInput(empty, 0, 'OTP: 987654.', 6).digits.join('')).toBe('987654');
  });
  it('a short paste starts at the box it was entered in', () => {
    const r = applyOtpInput(['1', '', '', '', '', ''], 1, '23', 6);
    expect(r.digits.join('')).toBe('123');
    expect(r.focusIndex).toBe(3);
    expect(r.complete).toBe(false);
  });
  it('a code longer than the boxes is truncated to the box count', () => {
    expect(applyOtpInput(empty, 0, '12345678', 6).digits.join('')).toBe('123456');
  });
  it('empty input clears the box and keeps focus', () => {
    const r = applyOtpInput(['1', '2', '', '', '', ''], 1, '', 6);
    expect(r.digits).toEqual(['1', '', '', '', '', '']);
    expect(r.focusIndex).toBe(1);
  });
  it('typing over an already-filled box keeps the newly typed digit', () => {
    expect(applyOtpInput(['1', '', '', '', '', ''], 0, '17', 6).digits[0]).toBe('7');
    expect(applyOtpInput(['1', '', '', '', '', ''], 0, '71', 6).digits[0]).toBe('7');
  });
  it('never mutates the array it was given', () => {
    const cur = ['1', '', '', '', '', ''];
    applyOtpInput(cur, 1, '2', 6);
    expect(cur).toEqual(['1', '', '', '', '', '']);
  });
});
