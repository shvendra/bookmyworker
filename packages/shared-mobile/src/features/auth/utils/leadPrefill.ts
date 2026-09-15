// Pure, framework-free logic for merging a matched website "Find Work" lead
// (from GET /api/v1/user/lead-lookup) into a NEW SelfWorker registration's
// submitted fields. Kept separate from RegisterOtpScreen so it's unit-testable
// without React Native / react-native-testing-library.

export interface LeadPrefillLead {
  gender?: string;
  state?: string;
  district?: string;
  workTypeValue?: string;
  subWorkTypeValue?: string;
}

export interface LeadPrefillCurrent {
  gender?: string;
  state?: string;
  district?: string;
  areasOfWork?: string[];
  categories?: string[];
}

export interface CategoryEntry {
  value: string;
  subcategories: Array<{ value: string }>;
}

export interface LeadPrefillResult {
  gender?: string;
  state?: string;
  district?: string;
  areasOfWork?: string[];
  categories?: string[];
}

// Computes ONLY the gap-filling values from a matched lead — every field here
// only fills a gap the user left empty; it never overwrites anything they
// actually entered. Work-type/sub-work-type are only filled when the lead's
// value is a REAL entry in `allCats` (the caller's own category picker data
// source) — next-web's taxonomy mostly, but not always, matches this app's;
// an unmatched slug is left alone for the user to pick manually rather than
// guessed at.
export function computeLeadPrefill(
  current: LeadPrefillCurrent,
  lead: LeadPrefillLead | null | undefined,
  allCats: CategoryEntry[]
): LeadPrefillResult {
  const result: LeadPrefillResult = {};
  if (!lead) return result;

  if (!current.gender && lead.gender) result.gender = lead.gender;
  if (!current.state && lead.state) result.state = lead.state;
  if (!current.district && lead.district) result.district = lead.district;

  // Only attempt a category prefill when the user hasn't already picked one.
  if (!current.areasOfWork && !current.categories) {
    if (lead.subWorkTypeValue) {
      const parent = allCats.find((c) =>
        c.subcategories.some((s) => s.value === lead.subWorkTypeValue)
      );
      if (parent) {
        result.areasOfWork = [parent.value];
        result.categories = [lead.subWorkTypeValue];
      }
      // No matching subcategory in this app's own taxonomy → leave unset.
    } else if (lead.workTypeValue && allCats.some((c) => c.value === lead.workTypeValue)) {
      result.areasOfWork = [lead.workTypeValue];
    }
  }

  return result;
}
