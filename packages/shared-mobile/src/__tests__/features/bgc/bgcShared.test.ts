import { bgcFmtCount, applyBgcPrefill, bgcDateTime, bgcInr, bgcStatusColors, emptyBgcWorker, validateBgcRow } from '../../../features/bgc/bgcShared';

const valid = () => ({
  ...emptyBgcWorker(), phone: '9876543210', name: 'Ravi Kumar', fatherName: 'Suresh Kumar', dob: '1995-04-12',
  address: { line: '12 Gandhi Nagar', block: '', district: 'Rewa', state: 'Madhya Pradesh', pincode: '486001' },
});

describe('validateBgcRow', () => {
  it('accepts a complete row', () => expect(validateBgcRow(valid())).toBeNull());
  it.each([
    ['bgc_errPhone', { phone: '1234567890' }],
    ['bgc_errName', { name: 'R' }],
    ['bgc_errFather', { fatherName: '' }],
    ['bgc_errDob', { dob: '12-04-1995' }],
    ['bgc_errDob', { dob: '1995-99-99' }],
  ])('%s', (key, over) => expect(validateBgcRow({ ...valid(), ...over })).toBe(key));
  it('flags address and pincode', () => {
    expect(validateBgcRow({ ...valid(), address: { ...valid().address, line: '' } })).toBe('bgc_errAddress');
    expect(validateBgcRow({ ...valid(), address: { ...valid().address, pincode: '4860' } })).toBe('bgc_errPincode');
  });
});

describe('applyBgcPrefill', () => {
  it('fills blanks but never overwrites what the employer typed', () => {
    const row = { ...emptyBgcWorker(), name: 'My Typed Name' };
    const out = applyBgcPrefill(row, { userId: 'w1', name: 'Profile Name', gender: 'Male', address: { line: 'Near temple', state: 'MP', pincode: '486001' } });
    expect(out).toMatchObject({ found: true, userId: 'w1', name: 'My Typed Name', gender: 'Male' });
    expect(out.address).toMatchObject({ line: 'Near temple', state: 'MP', pincode: '486001', district: '' });
  });
  it('no profile → found:false, row untouched', () => {
    expect(applyBgcPrefill({ ...emptyBgcWorker(), name: 'X' }, null)).toMatchObject({ found: false, name: 'X' });
  });
});

describe('formatting', () => {
  it('rupees with 2 decimals', () => expect(bgcInr(1062)).toBe('₹1,062.00'));
  it('dates tolerate junk', () => { expect(bgcDateTime(null)).toBe('—'); expect(bgcDateTime('nope')).toBe('—'); expect(bgcDateTime('2026-10-16T10:00:00Z')).toMatch(/2026/); });
  it('status colours have a safe default', () => { expect(bgcStatusColors('clear').color).toBe('#15803d'); expect(bgcStatusColors('weird')).toEqual({ color: '#475569', bg: '#f1f5f9' }); });
});

import { BGC_DOC_TYPES, bgcFmtSize, checkBgcFile, validateBgcWorker } from '../../../features/bgc/bgcShared';

describe('validateBgcWorker (field-keyed, same rules as the server)', () => {
  const good = () => ({ ...valid(), documents: [{ docRef: 'r', docType: 'aadhaar', label: 'Aadhaar card', fileName: 'a.jpg', size: 100 }] });
  it('accepts a complete worker', () => expect(validateBgcWorker(good())).toEqual({}));
  it('names the failing field', () => {
    const e = validateBgcWorker({ ...good(), phone: '123', name: '', fatherName: '', dob: 'nope', address: { line: 'x', block: '', district: '', state: '', pincode: '12' } });
    expect(e).toMatchObject({ phone: 'bgc_errPhone', name: 'bgc_errName', fatherName: 'bgc_errFather', dob: 'bgc_errDob', 'address.line': 'bgc_errAddress', 'address.state': 'bgc_errState', 'address.district': 'bgc_errDistrict', 'address.pincode': 'bgc_errPincode' });
  });
  it('age must be 18–75', () => {
    expect(validateBgcWorker({ ...good(), dob: '2015-01-01' }).dob).toBe('bgc_errAge');
    expect(validateBgcWorker({ ...good(), dob: '1900-01-01' }).dob).toBe('bgc_errAge');
  });
  it('an ID document is mandatory; a photo or "other" alone does not count', () => {
    expect(validateBgcWorker({ ...good(), documents: [] }).documents).toBe('bgc_errDocs');
    expect(validateBgcWorker({ ...good(), documents: [{ docRef: 'r', docType: 'photo', label: '', fileName: '', size: 1 }] }).documents).toBe('bgc_errDocs');
    expect(validateBgcWorker({ ...good(), documents: [{ docRef: 'r', docType: 'voter', label: '', fileName: '', size: 1 }] })).toEqual({});
  });
});

describe('checkBgcFile / formatting', () => {
  it('rejects wrong type, empty and oversize files with the offending name', () => {
    expect(checkBgcFile({ name: 'a.exe', mimeType: 'application/x-msdownload', size: 5 })).toEqual({ key: 'bgc_errFileType', params: { name: 'a.exe' } });
    expect(checkBgcFile({ name: 'a.png', mimeType: 'image/png', size: 0 })?.key).toBe('bgc_errFileEmpty');
    expect(checkBgcFile({ name: 'a.png', mimeType: 'image/png', size: 6 * 1048576 })).toEqual({ key: 'bgc_errFileSize', params: { name: 'a.png', size: '6.0 MB', max: 5 } });
    expect(checkBgcFile({ name: 'a.pdf', mimeType: 'application/pdf', size: 3 * 1048576 })).toBeNull();
    expect(checkBgcFile({ name: 'a.pdf', mimeType: 'application/pdf', size: 3 * 1048576 }, 2)?.key).toBe('bgc_errFileSize');
  });
  it('sizes and doc types', () => {
    expect(bgcFmtSize(2048)).toBe('2 KB');
    expect(bgcFmtSize(1048576 * 2.5)).toBe('2.5 MB');
    expect(BGC_DOC_TYPES.map((d) => d.key)).toContain('aadhaar');
  });
});

describe('social proof count', () => {
  it('formats in the Indian grouping', () => {
    const { bgcFmtCount } = require('../../../features/bgc/bgcShared');
    expect(bgcFmtCount(12450)).toBe('12,450');
    expect(bgcFmtCount(0)).toBe('0');
    expect(bgcFmtCount(undefined as unknown as number)).toBe('0');
  });
});
