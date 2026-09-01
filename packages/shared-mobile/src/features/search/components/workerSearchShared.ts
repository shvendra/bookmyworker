// Shared tokens, types, label maps and helpers for the worker-search feature.
// Extracted verbatim from WorkerSearchScreen so the screen and its sub-components
// (FilterSheet, AgentCard, PickerModal, …) can share one source. Behaviour-only —
// no rendering, no hooks.
import WORKER_CATEGORIES from '../../../shared/data/categories.json';
import { indianStates } from '../../../shared/data/stateDistrict';
import i18n from '../../../core/i18n';
import { getSubCatLabel } from '../../../shared/utils/labelUtils';
import { ageString } from '../../../shared/utils/ageUtils';

// ─── Design Tokens ────────────────────────────────────────────────────────────
export const BRAND       = '#1037A4';
export const BRAND_DARK  = '#0d2d8f';
export const BRAND_SOFT  = '#e8eeff';
export const AGENT_COL   = '#7c3aed';
export const AGENT_SOFT  = '#f5f3ff';
export const GREEN       = '#16a34a';
export const GREEN_SOFT  = '#f0fdf4';

// A worker is "new" when registered within the last 15 days (uses createdAt
// from the search API). Display-only; independent of the verified badge.
export const NEW_WORKER_WINDOW_MS = 15 * 24 * 60 * 60 * 1000;
export const isNewWorker = (createdAt?: string): boolean => {
  if (!createdAt) return false;
  const t = new Date(createdAt).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= NEW_WORKER_WINDOW_MS;
};
export const AMBER       = '#d97706';
export const AMBER_SOFT  = '#fffbeb';
export const WHITE       = '#ffffff';
export const SLATE       = '#64748b';
export const SLATE_LT    = '#f1f5f9';
export const BORDER      = '#e2e8f0';
export const NAVY        = '#0f172a';

// Legacy palette aliases used across sub-components
export const C = {
  navy:        NAVY,
  blue:        BRAND,
  blueDark:    BRAND_DARK,
  blueSoft:    BRAND_SOFT,
  blueLight:   '#dbeafe',
  indigo:      AGENT_COL,
  indigoSoft:  AGENT_SOFT,
  green:       GREEN,
  greenSoft:   GREEN_SOFT,
  greenLight:  '#bbf7d0',
  amber:       AMBER,
  amberSoft:   AMBER_SOFT,
  amberLight:  '#fde68a',
  red:         '#dc2626',
  redSoft:     '#fff1f2',
  slate:       SLATE,
  slateLight:  SLATE_LT,
  slateXLight: '#f8fafc',
  border:      BORDER,
  white:       WHITE,
  shadow:      NAVY,
};

// ─── Types ────────────────────────────────────────────────────────────────────
export type SubEntry = { label: string; value: string; [field: string]: string };
export interface CatEntry {
  label: string;
  value: string;
  subcategories?: SubEntry[];
}
export const CATEGORIES = WORKER_CATEGORIES as CatEntry[];

// Top-level category names have full 11-language translations under the `cat_*`
// keys (default `translation` namespace, shared with the agent app). categories.json
// ships per-language label fields for all 13 categories AND all 269 subcategories.
const CAT_KEY_BY_VALUE: Record<string, string> = {
  construction_project_workers: 'cat_construction',
  manufacturing_industrial_workers: 'cat_manufacturing',
  agriculture_farming_workers: 'cat_agriculture',
  event_decoration_workers: 'cat_event',
  household_domestic_workers: 'cat_household',
  hospitality_service_workers: 'cat_hospitality',
  transport_logistics_workers: 'cat_transport',
  retail_shop_workers: 'cat_retail',
  skilled_technical_workers: 'cat_technical',
  specialized_creative_workers: 'cat_creative',
  'Automobile & Workshop Workers': 'cat_automobile',
  'Healthcare Support Workers': 'cat_healthcare',
  'Security & Facility Workers': 'cat_security',
};
const CAT_KEY_BY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIES
    .map((c) => [c.label, CAT_KEY_BY_VALUE[c.value]] as const)
    .filter((pair): pair is readonly [string, string] => Boolean(pair[1])),
);

/** Translate a top-level category's English label to the active language via the
 *  shared `cat_*` keys. Falls back to the English label when unmapped. */
export const catDisplay = (label: string): string => {
  const key = CAT_KEY_BY_LABEL[label];
  return key ? i18n.t(key) : label;
};

/** Normalized form of a top-level CATEGORY value or label → its `cat_*` key. */
const CAT_KEY_BY_NORM: Record<string, string> = (() => {
  const norm = (s: string): string => String(s || '').trim().toLowerCase().replace(/[_&/-]+/g, ' ').replace(/\s+/g, ' ');
  const m: Record<string, string> = {};
  for (const [val, key] of Object.entries(CAT_KEY_BY_VALUE)) m[norm(val)] = key;
  CATEGORIES.forEach((c) => {
    const key = CAT_KEY_BY_VALUE[c.value];
    if (key) m[norm(c.label)] = key;
  });
  return m;
})();

/** Translate an occupational label (subcategory OR top-level category) to the
 *  active language. Display-only — stored filter value stays English. */
export const subcatDisplay = (label: string): string => {
  if (!label) return label;
  const norm = String(label).trim().toLowerCase().replace(/[_&/-]+/g, ' ').replace(/\s+/g, ' ');
  const catKey = CAT_KEY_BY_NORM[norm];
  if (catKey) return i18n.t(catKey);
  return getSubCatLabel(label, (i18n.language || 'en').split('-')[0]);
};

/** Worker-card meta values (gender, qualification/sub-type, agent-type). */
const META_KEY_BY_VALUE: Record<string, string> = {
  Male: 'ws_male', Female: 'ws_female', Other: 'ws_other',
  'ITI/Diploma': 'ws_iti_diploma', Graduate: 'ws_graduate',
  '10th/12th/ITI': 'ws_school_iti', 'Diploma/Graduate': 'ws_diploma_graduate',
  Skilled: 'ws_skilled', 'Semi-Skilled': 'ws_semiSkilled', 'Semi Skilled': 'ws_semiSkilled', Unskilled: 'ws_unskilled',
  'Group worker supplier':     'ws_agentType_group',
  'Skilled worker supplier':   'ws_agentType_skilled',
  'Unskilled worker supplier': 'ws_agentType_unskilled',
  'Contract worker supplier':  'ws_agentType_contract',
};
export const metaDisplay = (val?: string | null): string => {
  if (!val) return '';
  const key = META_KEY_BY_VALUE[val];
  return key ? i18n.t(`employer:${key}`) : val;
};

export interface WorkerFilters {
  workerType: string;
  subCategory: string;
  state: string;
  district: string;
  tehsil: string;
  gender: string;
  workerGroup: string;
  ageMin: string;
  ageMax: string;
  qualification: string;
  hasResume: boolean;
}
export const EMPTY_FILTERS: WorkerFilters = {
  workerType: '',
  subCategory: '',
  state: '',
  district: '',
  tehsil: '',
  gender: '',
  workerGroup: '',
  ageMin: '',
  ageMax: '',
  qualification: '',
  hasResume: false,
};

// Figma outcome palette — map each status to a semantic colour (dot + text).
// Exported as stable singletons: callers compare `getOutcomeColor(x) === OUTCOME_GREEN`.
export const OUTCOME_RED   = { color: '#B91C40', dot: '#E11D48' };
export const OUTCOME_GREEN = { color: '#137A38', dot: '#16A34A' };
export const OUTCOME_BLUE  = { color: '#2243BC', dot: '#2C50D6' };
export const OUTCOME_AMBER = { color: '#B45309', dot: '#D97706' };
export const OUTCOME_GREY  = { color: '#5B6478', dot: '#9AA3B5' };
export const getOutcomeColor = (v?: string): { color: string; dot: string } => {
  const s = (v ?? '').toLowerCase();
  if (!s) return OUTCOME_GREY;
  if (/(not_interest|not_relevant|not_looking|wrong|invalid|declin|reject)/.test(s)) return OUTCOME_RED;
  if (/(confirm|hired|joined|onboard|placed)/.test(s)) return OUTCOME_BLUE;
  if (/(later|maybe|follow_up_required|busy|pending|reschedul)/.test(s)) return OUTCOME_AMBER;
  if (/(interest|relevant|available|follow_up_done|selected|shortlist)/.test(s)) return OUTCOME_GREEN;
  return OUTCOME_GREY;
};

export const CALL_OUTCOMES = [
  { value: 'not_picked',            labelKey: 'ws_outcome_not_picked' },
  { value: 'switched_off',          labelKey: 'ws_outcome_switched_off' },
  { value: 'busy',                  labelKey: 'ws_outcome_busy' },
  { value: 'wrong_number',          labelKey: 'ws_outcome_wrong_number' },
  { value: 'invalid_number',        labelKey: 'ws_outcome_invalid_number' },
  { value: 'call_later',            labelKey: 'ws_outcome_call_later' },
  { value: 'follow_up_required',    labelKey: 'ws_outcome_follow_up_required' },
  { value: 'follow_up_done',        labelKey: 'ws_outcome_follow_up_done' },
  { value: 'available_immediately', labelKey: 'ws_outcome_available_immediately' },
  { value: 'available_next_week',   labelKey: 'ws_outcome_available_next_week' },
  { value: 'available_next_month',  labelKey: 'ws_outcome_available_next_month' },
  { value: 'currently_working',     labelKey: 'ws_outcome_currently_working' },
  { value: 'interested',            labelKey: 'ws_outcome_interested' },
  { value: 'highly_interested',     labelKey: 'ws_outcome_highly_interested' },
  { value: 'not_interested',        labelKey: 'ws_outcome_not_interested' },
  { value: 'maybe_interested',      labelKey: 'ws_outcome_maybe_interested' },
  { value: 'relevant',              labelKey: 'ws_outcome_relevant' },
  { value: 'not_relevant',          labelKey: 'ws_outcome_not_relevant' },
  { value: 'job_confirmed',         labelKey: 'ws_outcome_job_confirmed' },
  { value: 'joined_work',           labelKey: 'ws_outcome_joined_work' },
];

export type TFunc = (key: string, opts?: Record<string, unknown>) => string;

// ─── Helpers ──────────────────────────────────────────────────────────────────
export const normalizeText = (text = ''): string =>
  String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ');

export const timeAgoDate = (date: Date, t: TFunc): string => {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('ws_time_just_now');
  if (mins < 60) return t('ws_time_minutes_ago', { count: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('ws_time_hours_ago', { count: hrs });
  if (Math.floor(hrs / 24) === 1) return t('ws_time_yesterday');
  return t('ws_time_days_ago', { count: Math.floor(hrs / 24) });
};

export const formatName = (name = ''): string =>
  name
    .toLowerCase()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

// Birth year / legacy age / full date string / timestamp → current age string.
export const getAge = (dob?: string | number): string => ageString(dob);

export const getCategorySubcategories = (selected: string): string[] => {
  if (!selected) return [];
  const cat = CATEGORIES.find(
    (c) =>
      normalizeText(c.label) === normalizeText(selected) ||
      normalizeText(c.value) === normalizeText(selected),
  );
  return (cat?.subcategories ?? []).map((s) => normalizeText(s.label || s.value));
};

export const getMatchedAreasOfWork = (areas: string[] = [], selected = ''): string[] => {
  const normalized = areas
    .flatMap((item) => {
      try {
        if (typeof item === 'string' && item.startsWith('['))
          return JSON.parse(item) as string[];
        return item;
      } catch {
        return item;
      }
    })
    .filter(Boolean)
    .map((item) => normalizeText(String(item)));
  if (!selected) return normalized;
  const allowed = getCategorySubcategories(selected);
  return normalized.filter((a) => allowed.includes(a));
};

// All Indian place names (state / district / block) for filtering location values
// that were mis-entered into a worker's areasOfWork (so they don't show as skills).
const PLACE_NAMES: Set<string> = (() => {
  const set = new Set<string>();
  for (const [state, districts] of Object.entries(indianStates)) {
    set.add(state.toLowerCase());
    for (const [district, blocks] of Object.entries(districts as Record<string, string[]>)) {
      set.add(district.toLowerCase());
      (blocks ?? []).forEach((b) => set.add(String(b).toLowerCase()));
    }
  }
  return set;
})();

export const isPlaceName = (v: string): boolean => {
  const lc = v.trim().toLowerCase();
  return PLACE_NAMES.has(lc) || PLACE_NAMES.has(lc.replace(/\s+(city|district|tehsil|block)$/, ''));
};

/** De-duplicate skill chips (case-insensitive) and drop location names that were
 *  mistakenly saved as skills — keeps the worker card showing real work types. */
export const cleanSkills = (areas: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const a of areas) {
    const v = String(a).trim();
    if (!v) continue;
    const lc = v.toLowerCase();
    if (seen.has(lc) || isPlaceName(v)) continue;
    seen.add(lc);
    out.push(v);
  }
  return out;
};

export function countActive(f: WorkerFilters): number {
  return [
    f.workerType,
    f.subCategory,
    f.state,
    f.district,
    f.tehsil,
    f.gender,
    f.workerGroup,
    f.ageMin,
    f.ageMax,
    f.qualification,
    f.hasResume,
  ].filter(Boolean).length;
}
