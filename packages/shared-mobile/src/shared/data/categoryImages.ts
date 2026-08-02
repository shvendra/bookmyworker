// ── Category → hero image resolver ───────────────────────────────────────────
// Maps a work-category OR sub-category value to a curated hero image, used to
// make notifications (and other surfaces) visual like Zomato/Flipkart cards.
//
// WORK_CATEGORIES (13 top-level categories) carry the curated images; the full
// taxonomy (categories.json, 25 categories × ~500 sub-categories) is used only
// to resolve a sub-category up to its parent. FAIL-SAFE: any value that can't be
// mapped returns null, so callers simply fall back to their icon/emoji.
import categoriesData from './categories.json';
import { WORK_CATEGORIES } from '../components/ui/WorkerCategoryGrid';

// top-level category value -> curated hero image URL
const CATEGORY_IMAGE: Record<string, string> = {};
for (const c of WORK_CATEGORIES) {
  if (c?.value && c?.image) CATEGORY_IMAGE[c.value] = c.image;
}

// sub-category value -> parent top-level category value
const SUBCAT_TO_PARENT: Record<string, string> = {};
try {
  const cats = categoriesData as Array<{ value?: string; subcategories?: Array<{ value?: string }> }>;
  for (const cat of cats) {
    if (!cat?.value) continue;
    for (const sub of cat.subcategories ?? []) {
      if (sub?.value) SUBCAT_TO_PARENT[sub.value] = cat.value;
    }
  }
} catch {
  // taxonomy shape guard — never throw at import time
}

/**
 * Resolve a category OR sub-category value to a hero image URL.
 * Returns null when nothing sensible maps (caller keeps its emoji/icon).
 */
export const categoryImageFor = (value?: string | null): string | null => {
  if (!value) return null;
  const v = String(value);
  if (CATEGORY_IMAGE[v]) return CATEGORY_IMAGE[v];
  const parent = SUBCAT_TO_PARENT[v];
  if (parent && CATEGORY_IMAGE[parent]) return CATEGORY_IMAGE[parent];
  return null;
};
