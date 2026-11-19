import { countNonLocationActive, isOutsidePlanScope, effectiveLocation } from '../../features/search/components/workerFilterGate';

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

describe('effectiveLocation — typing in the search box searches all of India', () => {
  const home = { state: 'Delhi', district: '' };
  const onHome = { state: 'Delhi', district: '', tehsil: '' };
  it('no search text: the home state still applies', () => {
    expect(effectiveLocation(onHome, home, '')).toEqual({ state: 'Delhi', district: '', tehsil: '', widened: false });
    expect(effectiveLocation(onHome, home, '   ')).toMatchObject({ state: 'Delhi', widened: false });
  });
  it('search text + default home state: the state is dropped (all India)', () => {
    expect(effectiveLocation(onHome, home, 'Rewa')).toEqual({ state: '', district: '', tehsil: '', widened: true });
  });
  it('a district-plan employer\'s default district is dropped too', () => {
    const h = { state: 'Delhi', district: 'Central Delhi' };
    expect(effectiveLocation({ state: 'Delhi', district: 'Central Delhi', tehsil: '' }, h, 'Rewa')).toMatchObject({ state: '', district: '', widened: true });
  });
  it('a location the employer chose in the filter sheet is respected while searching', () => {
    expect(effectiveLocation({ state: 'Bihar', district: '', tehsil: '' }, home, 'Patna')).toEqual({ state: 'Bihar', district: '', tehsil: '', widened: false });
    expect(effectiveLocation({ state: 'Delhi', district: 'South Delhi', tehsil: '' }, home, 'Ravi')).toMatchObject({ state: 'Delhi', district: 'South Delhi', widened: false });
    expect(effectiveLocation({ state: 'Delhi', district: '', tehsil: 'X' }, home, 'Ravi')).toMatchObject({ state: 'Delhi', tehsil: 'X', widened: false });
  });
  it('"All States" chosen in the filter (empty state) stays all India either way', () => {
    expect(effectiveLocation({ state: '', district: '', tehsil: '' }, home, 'Rewa')).toMatchObject({ state: '', widened: false });
  });
  it('no home location known: nothing to widen', () => {
    expect(effectiveLocation({ state: '', district: '', tehsil: '' }, { state: '', district: '' }, 'Rewa').widened).toBe(false);
  });
});
