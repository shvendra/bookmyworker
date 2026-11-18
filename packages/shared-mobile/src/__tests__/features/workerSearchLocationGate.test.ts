import { countNonLocationActive, isOutsidePlanScope } from '../../features/search/components/workerFilterGate';

describe('worker-search free location browsing', () => {
  it('state / district / block alone do not count as plan-gated filters', () => {
    const f = { state: 'Delhi', district: 'Central Delhi', tehsil: 'X' };
    expect(countNonLocationActive(f)).toBe(0);
  });
  it('category, gender, age, qualification, resume, group still count (still need a plan)', () => {
    for (const patch of [{ workerType: 'a' }, { subCategory: 'b' }, { gender: 'Male' }, { ageMin: '20' }, { ageMax: '30' }, { qualification: 'q' }, { workerGroup: 'g' }]) {
      expect(countNonLocationActive({ state: 'Delhi', ...patch })).toBe(1);
    }
  });
});

describe('isOutsidePlanScope (mirrors the backend contact rule)', () => {
  const emp = { state: 'Delhi', district: 'Central Delhi' };
  it('india / unknown scope: never outside', () => {
    expect(isOutsidePlanScope('india', emp, { state: 'Bihar', district: 'Patna' })).toBe(false);
    expect(isOutsidePlanScope(undefined, emp, { state: 'Bihar', district: 'Patna' })).toBe(false);
  });
  it('state plan: other state is outside, same state (any district) is inside', () => {
    expect(isOutsidePlanScope('state', emp, { state: 'Bihar', district: 'Patna' })).toBe(true);
    expect(isOutsidePlanScope('state', emp, { state: ' delhi', district: 'South Delhi' })).toBe(false);
  });
  it('district plan: other district / blank district is outside', () => {
    expect(isOutsidePlanScope('district', emp, { state: 'Delhi', district: 'South Delhi' })).toBe(true);
    expect(isOutsidePlanScope('district', emp, { state: 'Delhi', district: '' })).toBe(true);
    expect(isOutsidePlanScope('district', emp, { state: 'Delhi', district: 'central delhi' })).toBe(false);
  });
  it('fail-open without a saved employer location', () => {
    expect(isOutsidePlanScope('district', {}, { state: 'Bihar', district: 'Patna' })).toBe(false);
  });
});
