import i18n from '../../core/i18n';
import WORKER_CATEGORIES from './categories.json';
import { getOccupationLabel } from '../utils/labelUtils';

// Shared occupational-label translators. categories.json ships a per-language label
// field for every category and subcategory (label/hindilabel/marathilabel/
// gujaratilabel/tamillabel/telugulabel/kannadalabel/malayalamlabel/banglalabel/
// odialabel/punjabilabel). These helpers map an English label (as stored on a
// worker's areasOfWork / a filter value) to the active language — display-only;
// the stored English value is never changed. Used by WorkerSearch + the employer
// dashboard so subcategory chips translate to all 11 languages.

type SubEntry = { label: string; value: string; [field: string]: string };
type CatEntry = { label: string; value: string; subcategories?: SubEntry[] };
const CATEGORIES = WORKER_CATEGORIES as CatEntry[];

/** Active i18n language → categories.json label field. */
const LANG_FIELD: Record<string, string> = {
  hi: 'hindilabel', mr: 'marathilabel', gu: 'gujaratilabel', ta: 'tamillabel',
  te: 'telugulabel', kn: 'kannadalabel', ml: 'malayalamlabel', bn: 'banglalabel',
  or: 'odialabel', pa: 'punjabilabel',
};

/** English subcategory label OR value (case-insensitive) → its categories.json
 *  entry. Worker `areasOfWork` is stored sometimes as the label ("Truck Driver")
 *  and sometimes as the value ("truck_driver" / "lmv driver"), so we index both. */
const SUBCAT_BY_LABEL: Map<string, SubEntry> = (() => {
  const m = new Map<string, SubEntry>();
  CATEGORIES.forEach((c) =>
    (c.subcategories ?? []).forEach((s) => {
      if (s?.value) m.set(String(s.value).trim().toLowerCase(), s);
      if (s?.label) m.set(String(s.label).trim().toLowerCase(), s);
    }),
  );
  return m;
})();

/** Title-case fallback for skills that aren't in categories.json (so a miss still
 *  reads professionally, e.g. "lmv driver" → "Lmv Driver"). */
const titleCase = (s: string): string =>
  s.replace(/_/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, (c) => c.toUpperCase());

/** Translate an occupational label — a sub-category OR a top-level category — to
 *  the active language. Delegates to the unified `getOccupationLabel`: top-level
 *  categories (e.g. "construction project workers") translate via the `cat_*`
 *  keys, sub-categories (e.g. "lmv driver", "other retail") via the per-language
 *  categories.json fields with value+label+fuzzy matching — all 11 languages.
 *  Falls back to readable English. Reactive via useTranslation. */
export const subcatDisplay = (label: string): string => {
  if (!label) return label;
  const lang = (i18n.language || 'en').split('-')[0];
  const out = getOccupationLabel(label, ((k: string) => i18n.t(k)) as Parameters<typeof getOccupationLabel>[1], lang);
  return out || titleCase(String(label));
};

/** Normalize a worker's raw `areasOfWork` into a clean list of skill strings:
 *  unwraps a JSON-stringified array (sometimes stored as the first element),
 *  drops null / "null" / "undefined" / empty values (including a null first
 *  element), and de-duplicates while preserving order. */
export const parseAreasOfWork = (raw: unknown): string[] => {
  const isBad = (s: string): boolean =>
    !s || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined';
  let items: unknown[] = Array.isArray(raw) ? [...raw] : typeof raw === 'string' ? [raw] : [];
  let clean = items.map((x) => (x == null ? '' : String(x).trim())).filter((s) => !isBad(s));
  // If the first remaining value is a JSON-stringified array, unwrap it.
  if (clean.length && clean[0].startsWith('[')) {
    try {
      const p = JSON.parse(clean[0]);
      if (Array.isArray(p)) clean = p.map((x) => (x == null ? '' : String(x).trim())).filter((s) => !isBad(s));
    } catch { /* leave as-is */ }
  }
  return Array.from(new Set(clean));
};

/** Clean + translate + comma-join a worker's areasOfWork for display.
 *  Returns '' when there are no valid skills (caller can hide the row). */
export const formatSkillList = (raw: unknown, max = 3): string =>
  parseAreasOfWork(raw).slice(0, max).map(subcatDisplay).join(', ');
