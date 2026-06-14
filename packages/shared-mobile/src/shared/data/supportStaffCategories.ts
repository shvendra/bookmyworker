/**
 * Support Staff (Office_Staff requirement type) category taxonomy.
 *
 * SUPPORT_STAFF_CATEGORY_VALUES are the category `value`s shown in the picker when
 * an employer posts an Office_Staff requirement — they must exist in
 * categories.json and have a matching `cat_<value>` i18n key (all 11 languages).
 *
 * LEGACY_SUPPORT_STAFF_VALUES are the older Permanent/Contract categories. They are
 * kept in categories.json (and their cat_ keys retained) so existing/historical
 * requirements still translate, but they are hidden from every picker.
 */
export const SUPPORT_STAFF_CATEGORY_VALUES = [
  'admin_office_support',
  'customer_service_crm',
  'billing_accounts_support',
  'logistics_warehouse',
  'sales_field_operations',
  'technical_service_support',
  'manufacturing_production_support',
  'ecommerce_operations',
  'security_compliance',
  'supervisory_roles',
] as const;

export const LEGACY_SUPPORT_STAFF_VALUES = [
  'support_staff_permanent',
  'support_staff_contract',
] as const;

// Categories that must never appear under a NON-Office_Staff requirement type.
export const HIDDEN_FROM_NON_SUPPORT = new Set<string>([
  ...SUPPORT_STAFF_CATEGORY_VALUES,
  ...LEGACY_SUPPORT_STAFF_VALUES,
]);

// Worker qualification tier (RegisterScreen `workerSubType`) whose work-category
// picker shows the Support Staff taxonomy instead of regular worker categories.
export const DIPLOMA_GRADUATE_SUBTYPE = 'Diploma/Graduate';

/**
 * Given the full list of category values and the worker's qualification tier,
 * returns the category values that should be offered:
 *  • Diploma/Graduate → the Support Staff categories only
 *  • any other tier   → regular worker categories (support staff + legacy removed)
 * Pure + dependency-free so it can be unit-tested without React Native.
 */
export function categoryValuesForWorkerTier(
  workerSubType: string,
  allCategoryValues: string[],
): string[] {
  if (workerSubType === DIPLOMA_GRADUATE_SUBTYPE) {
    const support = new Set<string>(SUPPORT_STAFF_CATEGORY_VALUES);
    return allCategoryValues.filter((v) => support.has(v));
  }
  return allCategoryValues.filter((v) => !HIDDEN_FROM_NON_SUPPORT.has(v));
}
