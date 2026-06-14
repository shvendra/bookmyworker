// Subset of WORK_CATEGORIES — a few categories are enough to drive the
// WorkCategorySelectScreen toggle / counter / label-formatting branches.
// One label intentionally contains both " Workers" and " & " so the
// `.replace(' Workers', '').replace(' & ', '\n& ')` formatting runs.
export type WorkCategory = {
  label: string;
  value: string;
  emoji: string;
  accent: string;
  translationKey: string;
};

export const WORK_CATEGORIES: WorkCategory[] = [
  { label: 'Manufacturing & Industrial Workers', value: 'manufacturing_industrial_workers', emoji: '⚙️', accent: '#3B82F6', translationKey: 'cat_manufacturing' },
  { label: 'Construction & Project', value: 'construction_project_workers', emoji: '🏗️', accent: '#F59E0B', translationKey: 'cat_construction' },
  { label: 'Transport & Logistics', value: 'transport_logistics_workers', emoji: '🚛', accent: '#6366F1', translationKey: 'cat_transport' },
];
