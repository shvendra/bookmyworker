export interface EditInput { qty: string; date: string; minW: string; maxW: string; title: string; isProject: boolean }
export interface EditErrors { qty: string; date: string; min: string; max: string; title: string }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** `YYYY-MM-DD` for an ISO/Date string, '' when empty or unparsable. */
export const toDay = (v?: string): string => {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
};

export const digitsOnly = (v: string): string => v.replace(/[^0-9]/g, '');

/** Returns translation KEYS (or '' when fine) so the caller localizes them. */
export function validateEdit(i: EditInput): EditErrors {
  const q = parseInt(i.qty, 10);
  const mn = parseInt(i.minW, 10);
  const mx = parseInt(i.maxW, 10);
  const dateOk = !i.date || (DATE_RE.test(i.date) && !Number.isNaN(new Date(i.date).getTime()));
  return {
    qty: q >= 1 ? '' : 'er_errQty',
    date: dateOk ? '' : 'er_errDate',
    min: mn >= 0 ? '' : 'er_errWage',
    max: !(mx >= 0) ? 'er_errWage' : mn > mx ? 'er_errRange' : '',
    title: i.isProject && i.title.trim().length < 3 ? 'er_errTitle' : '',
  };
}
export const isEditValid = (e: EditErrors): boolean => !e.qty && !e.date && !e.min && !e.max && !e.title;
