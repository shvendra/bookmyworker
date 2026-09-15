import { computeLeadPrefill, type CategoryEntry } from '../../../features/auth/utils/leadPrefill';

// Small fixture mirroring the shape of shared/data/categories.json — enough to
// exercise the "does the lead's slug actually exist in this app's own
// taxonomy" matching logic without importing the full real dataset.
const CATS: CategoryEntry[] = [
  {
    value: 'construction_project_workers',
    subcategories: [{ value: 'mason' }, { value: 'carpenter' }],
  },
  {
    value: 'agriculture_farming_workers',
    subcategories: [{ value: 'farmer' }],
  },
];

describe('computeLeadPrefill', () => {
  it('returns an empty object when there is no lead', () => {
    expect(computeLeadPrefill({}, null, CATS)).toEqual({});
    expect(computeLeadPrefill({}, undefined, CATS)).toEqual({});
  });

  it('fills gender/state/district when the user left them empty', () => {
    const result = computeLeadPrefill(
      {},
      { gender: 'Male', state: 'Maharashtra', district: 'Pune' },
      CATS,
    );
    expect(result).toEqual({
      gender: 'Male',
      state: 'Maharashtra',
      district: 'Pune',
    });
  });

  it('never overwrites fields the user already entered', () => {
    const result = computeLeadPrefill(
      { gender: 'Female', state: 'Gujarat', district: 'Surat' },
      { gender: 'Male', state: 'Maharashtra', district: 'Pune' },
      CATS,
    );
    expect(result).toEqual({});
  });

  it('prefills areasOfWork (parent category) + categories (subcategory) when the sub-work-type is a real taxonomy entry', () => {
    const result = computeLeadPrefill(
      {},
      { subWorkTypeValue: 'mason', workTypeValue: 'construction_project_workers' },
      CATS,
    );
    expect(result.areasOfWork).toEqual(['construction_project_workers']);
    expect(result.categories).toEqual(['mason']);
  });

  it('does NOT prefill categories when the sub-work-type slug does not exist in this app\'s own taxonomy (diverged from next-web)', () => {
    const result = computeLeadPrefill(
      {},
      { subWorkTypeValue: 'quality check', workTypeValue: 'manufacturing_industrial_workers' },
      CATS,
    );
    expect(result.areasOfWork).toBeUndefined();
    expect(result.categories).toBeUndefined();
  });

  it('falls back to prefilling just the main category when there is no sub-work-type but the main category matches', () => {
    const result = computeLeadPrefill(
      {},
      { workTypeValue: 'agriculture_farming_workers' },
      CATS,
    );
    expect(result.areasOfWork).toEqual(['agriculture_farming_workers']);
    expect(result.categories).toBeUndefined();
  });

  it('does not prefill any category fields when the user already picked one', () => {
    const result = computeLeadPrefill(
      { areasOfWork: ['agriculture_farming_workers'] },
      { subWorkTypeValue: 'mason', workTypeValue: 'construction_project_workers' },
      CATS,
    );
    expect(result.areasOfWork).toBeUndefined();
    expect(result.categories).toBeUndefined();
  });

  it('does not prefill any category fields when the user already picked subcategories', () => {
    const result = computeLeadPrefill(
      { categories: ['farmer'] },
      { subWorkTypeValue: 'mason', workTypeValue: 'construction_project_workers' },
      CATS,
    );
    expect(result.areasOfWork).toBeUndefined();
    expect(result.categories).toBeUndefined();
  });

  it('a lookup returning an empty object results in no prefill at all', () => {
    expect(computeLeadPrefill({}, {}, CATS)).toEqual({});
  });
});
