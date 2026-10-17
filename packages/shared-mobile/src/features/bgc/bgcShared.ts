// Same wording/colours as the CRM + website; backend utils/bgcStatus.js is the source of truth for the keys.
export const BGC_STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  awaiting_payment:    { color: '#b45309', bg: '#fef3c7' },
  received:            { color: '#1d4ed8', bg: '#dbeafe' },
  documents_review:    { color: '#7c3aed', bg: '#ede9fe' },
  police_verification: { color: '#0369a1', bg: '#e0f2fe' },
  on_hold:             { color: '#c2410c', bg: '#ffedd5' },
  clear:               { color: '#15803d', bg: '#dcfce7' },
  adverse:             { color: '#b91c1c', bg: '#fee2e2' },
  cancelled:           { color: '#64748b', bg: '#f1f5f9' },
};
export const bgcStatusColors = (s: string): { color: string; bg: string } =>
  BGC_STATUS_COLORS[s] ?? { color: '#475569', bg: '#f1f5f9' };

export const bgcInr = (n: number): string =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const bgcDateTime = (d?: string | null): string => {
  if (!d) return '—';
  const dt = new Date(d);
  return Number.isNaN(dt.getTime())
    ? '—'
    : dt.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
};

export const emptyBgcWorker = () => ({
  userId: '', name: '', fatherName: '', gender: '', dob: '', phone: '', altPhone: '', email: '',
  address: { line: '', block: '', district: '', state: '', pincode: '' },
  idType: '', idNumber: '', found: false,
  documents: [] as import('../../core/api/endpoints/bgcApi').BgcStagedDoc[],
});
export type BgcWorkerRow = ReturnType<typeof emptyBgcWorker>;

/** Merge the server's pre-fill into a row; never overwrites anything the employer already typed. */
export function applyBgcPrefill(row: BgcWorkerRow, w: import('../../core/api/endpoints/bgcApi').BgcLookupResult['worker']): BgcWorkerRow {
  if (!w) return { ...row, found: false };
  const keep = (cur: string, v?: string): string => (cur.trim() ? cur : v ?? '');
  const a = w.address ?? {};
  return {
    ...row,
    found: true,
    userId: w.userId ?? row.userId,
    name: keep(row.name, w.name),
    gender: keep(row.gender, w.gender),
    altPhone: keep(row.altPhone, w.altPhone),
    email: keep(row.email, w.email),
    address: {
      line: keep(row.address.line, a.line), block: keep(row.address.block, a.block),
      district: keep(row.address.district, a.district), state: keep(row.address.state, a.state),
      pincode: keep(row.address.pincode, a.pincode),
    },
  };
}

/** Client-side check before the server's own validation. Returns an i18n key or null. */
export function validateBgcRow(r: BgcWorkerRow): string | null {
  if (!/^[6-9]\d{9}$/.test(r.phone)) return 'bgc_errPhone';
  if (r.name.trim().length < 2) return 'bgc_errName';
  if (r.fatherName.trim().length < 2) return 'bgc_errFather';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.dob) || Number.isNaN(new Date(r.dob).getTime())) return 'bgc_errDob';
  if (!r.address.line.trim() || !r.address.state.trim() || !r.address.district.trim()) return 'bgc_errAddress';
  if (!/^\d{6}$/.test(r.address.pincode)) return 'bgc_errPincode';
  return null;
}

export const BGC_DOC_TYPES = [
  { key: 'aadhaar', label: 'Aadhaar card' }, { key: 'voter', label: 'Voter ID' }, { key: 'pan', label: 'PAN card' },
  { key: 'driving', label: 'Driving licence' }, { key: 'passport', label: 'Passport' }, { key: 'ration', label: 'Ration card' },
  { key: 'photo', label: 'Passport-size photo' }, { key: 'other', label: 'Other document' },
];
export const BGC_DOC_MIMES = ['application/pdf', 'image/jpeg', 'image/png'];

export const bgcFmtSize = (b: number): string => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** Returns an i18n key (+ params) or null. The server re-checks everything. */
export function checkBgcFile(f: { name: string; mimeType: string; size: number }, maxMb = 5): { key: string; params: Record<string, string | number> } | null {
  if (!BGC_DOC_MIMES.includes(f.mimeType)) return { key: 'bgc_errFileType', params: { name: f.name } };
  if (f.size === 0) return { key: 'bgc_errFileEmpty', params: { name: f.name } };
  if (f.size > maxMb * 1048576) return { key: 'bgc_errFileSize', params: { name: f.name, size: bgcFmtSize(f.size), max: maxMb } };
  return null;
}

/** Same rules as the server. Returns { fieldPath: i18nKey } (paths relative to the worker, e.g. 'address.line'). */
export function validateBgcWorker(r: BgcWorkerRow): Record<string, string> {
  const e: Record<string, string> = {};
  if (!/^[6-9]\d{9}$/.test(r.phone)) e.phone = 'bgc_errPhone';
  if (r.name.trim().length < 2) e.name = 'bgc_errName';
  if (r.fatherName.trim().length < 2) e.fatherName = 'bgc_errFather';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.dob) || Number.isNaN(new Date(r.dob).getTime())) e.dob = 'bgc_errDob';
  else {
    const age = (Date.now() - new Date(`${r.dob}T00:00:00Z`).getTime()) / (365.25 * 86400000);
    if (age < 18 || age > 75) e.dob = 'bgc_errAge';
  }
  if (!r.address.line.trim() || r.address.line.trim().length < 5) e['address.line'] = 'bgc_errAddress';
  if (!r.address.state.trim()) e['address.state'] = 'bgc_errState';
  if (!r.address.district.trim()) e['address.district'] = 'bgc_errDistrict';
  if (!/^\d{6}$/.test(r.address.pincode)) e['address.pincode'] = 'bgc_errPincode';
  if (!r.documents.some((d) => d.docType !== 'photo' && d.docType !== 'other')) e.documents = 'bgc_errDocs';
  return e;
}

/** "12,450" — the number in "12,450+ workers already police-verified" (the "+" lives in the translation). */
export const bgcFmtCount = (n: number): string => Number(n || 0).toLocaleString('en-IN');
