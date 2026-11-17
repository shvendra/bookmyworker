import { isNeverSubscribed } from '../../../features/employer/utils/happyCustomers';
import { validateEdit, isEditValid, toDay, digitsOnly } from '../../../features/jobs/utils/editRequirement';

describe('isNeverSubscribed (Happy Customers card audience)', () => {
  it('true only for employers who never took a plan', () => {
    expect(isNeverSubscribed({ isSubscribed: false })).toBe(true);
    expect(isNeverSubscribed({ isSubscribed: false, lastsubscriptionDate: null, subscriptionExpery: null })).toBe(true);
  });
  it('false once subscribed, or ever had a plan / expiry', () => {
    expect(isNeverSubscribed({ isSubscribed: true })).toBe(false);
    expect(isNeverSubscribed({ isSubscribed: false, lastsubscriptionDate: '2026-01-01' })).toBe(false);
    expect(isNeverSubscribed({ isSubscribed: false, subscriptionExpery: '2026-02-01' })).toBe(false);
  });
  it('false while the profile is not loaded', () => {
    expect(isNeverSubscribed(null)).toBe(false);
    expect(isNeverSubscribed(undefined)).toBe(false);
  });
});

describe('edit requirement validation', () => {
  const ok = { qty: '5', date: '2026-12-01', minW: '500', maxW: '700', title: '', isProject: false };
  it('accepts a valid edit', () => expect(isEditValid(validateEdit(ok))).toBe(true));
  it('date is optional', () => expect(isEditValid(validateEdit({ ...ok, date: '' }))).toBe(true));
  it('needs at least one worker', () => expect(validateEdit({ ...ok, qty: '0' }).qty).toBe('er_errQty'));
  it('rejects a malformed or impossible date', () => {
    expect(validateEdit({ ...ok, date: '01-12-2026' }).date).toBe('er_errDate');
    expect(validateEdit({ ...ok, date: '2026-13-45' }).date).toBe('er_errDate');
  });
  it('wages must be numbers and max must not be below min', () => {
    expect(validateEdit({ ...ok, minW: '' }).min).toBe('er_errWage');
    expect(validateEdit({ ...ok, maxW: '' }).max).toBe('er_errWage');
    expect(validateEdit({ ...ok, minW: '800', maxW: '700' }).max).toBe('er_errRange');
    expect(isEditValid(validateEdit({ ...ok, minW: '700', maxW: '700' }))).toBe(true);
  });
  it('a project needs a title of 3+ characters; a requirement does not', () => {
    expect(validateEdit({ ...ok, isProject: true, title: 'ab' }).title).toBe('er_errTitle');
    expect(validateEdit({ ...ok, isProject: true, title: 'Metro lines' }).title).toBe('');
    expect(validateEdit({ ...ok, isProject: false, title: '' }).title).toBe('');
  });
  it('helpers', () => {
    expect(toDay('2026-12-01T10:00:00.000Z')).toBe('2026-12-01');
    expect(toDay('garbage')).toBe('');
    expect(toDay(undefined)).toBe('');
    expect(digitsOnly('₹ 1,200a')).toBe('1200');
  });
});
