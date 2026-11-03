/** Quarterly employer feedback in the app: form rules + translations. Option values must match the server (backend/utils/selfFeedback.js). */
import * as fs from 'fs';
import * as path from 'path';
import {
  ASPECT_ROWS, FEEDBACK_STEPS, IMPROVE_CHOICES, MAX_IMPROVE, OVERALL_OPTIONS, PRICING_CHOICES, RENEW_CHOICES, SUPPORT_CHOICES,
  emptyDraft, isStepDone, toggleImprove, toSubmitBody, withRating,
} from '../../../features/employer/utils/feedbackForm';
import { employerTranslation as en } from '../../../core/i18n/locales/employer/en';
import { employerTranslation as hi } from '../../../core/i18n/locales/employer/hi';

const EN = en as unknown as Record<string, string>;
const HI = hi as unknown as Record<string, string>;

describe('options match the server', () => {
  const SERVER = fs.readFileSync(path.join(__dirname, '../../../../../../../backend/utils/selfFeedback.js'), 'utf8');
  const list = (name: string): string[] => {
    const m = SERVER.match(new RegExp(`export const ${name} = \\[([^\\]]*)\\]`));
    return (m?.[1] ?? '').split(',').map((x) => x.trim().replace(/"/g, '')).filter(Boolean);
  };
  it('every option value is one the backend accepts', () => {
    // Skipped quietly when the backend repo is not checked out next to the app.
    if (!SERVER) return;
    expect(list('SUPPORT_OPTIONS')).toEqual(SUPPORT_CHOICES.map((c) => c.value));
    expect(list('PRICING_OPTIONS')).toEqual(PRICING_CHOICES.map((c) => c.value));
    expect(list('RENEW_OPTIONS')).toEqual(RENEW_CHOICES.map((c) => c.value));
    expect(list('IMPROVE_AREAS')).toEqual(IMPROVE_CHOICES.map((c) => c.value));
    expect(list('ASPECTS').filter((a) => a !== 'support')).toEqual(ASPECT_ROWS.map((a) => a.key));
    expect(list('PLATFORMS')).toContain('app');
  });
  it('has five overall faces valued 1..5', () => {
    expect(OVERALL_OPTIONS.map((o) => o.value)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('steps', () => {
  it('step 1 needs an overall rating', () => {
    expect(isStepDone(0, emptyDraft())).toBe(false);
    expect(isStepDone(0, { ...emptyDraft(), overall: 4 })).toBe(true);
  });
  it('step 2 needs a rating or a support answer', () => {
    expect(isStepDone(1, emptyDraft())).toBe(false);
    expect(isStepDone(1, { ...emptyDraft(), ratings: { features: 4 } })).toBe(true);
    expect(isStepDone(1, { ...emptyDraft(), supportReceived: 'not_needed' })).toBe(true);
  });
  it('step 3 needs any one answer (recommend 0 counts)', () => {
    expect(isStepDone(2, emptyDraft())).toBe(false);
    expect(isStepDone(2, { ...emptyDraft(), recommend: 0 })).toBe(true);
    expect(isStepDone(2, { ...emptyDraft(), pricing: 'fair' })).toBe(true);
    expect(isStepDone(2, { ...emptyDraft(), improve: ['speed'] })).toBe(true);
  });
  it('has three steps', () => { expect(FEEDBACK_STEPS).toBe(3); });
});

describe('answers', () => {
  it('toggleImprove adds, removes and stops at the maximum', () => {
    let v: string[] = [];
    for (const x of ['speed', 'pricing', 'support', 'reports']) v = toggleImprove(v, x);
    expect(v).toEqual(['speed', 'pricing', 'support']);
    expect(v).toHaveLength(MAX_IMPROVE);
    expect(toggleImprove(v, 'pricing')).toEqual(['speed', 'support']);
  });
  it('withRating sets, clears and never mutates', () => {
    const a = { features: 3 };
    const b = withRating(a, 'features', 5);
    expect(b).toEqual({ features: 5 });
    expect(a).toEqual({ features: 3 });
    expect(withRating(b, 'features', 0)).toEqual({});
  });
  it('the submit body drops a support rating unless support was received, and the reason unless it went wrong', () => {
    const d = { ...emptyDraft(), overall: 4, ratings: { support: 5, features: 4 }, supportReceived: 'no', supportIssue: 'no reply' };
    expect(toSubmitBody(d)).toMatchObject({ ratings: { features: 4 }, supportIssue: 'no reply', platform: 'app' });
    expect(toSubmitBody({ ...d, supportReceived: 'yes' }).ratings).toEqual({ support: 5, features: 4 });
    expect(toSubmitBody({ ...d, supportReceived: 'yes' }).supportIssue).toBe('');
  });
  it('the submit body trims long text and extra improve picks', () => {
    const body = toSubmitBody({ ...emptyDraft(), overall: 3, comment: 'x'.repeat(900), supportReceived: 'no', supportIssue: 'y'.repeat(900), improve: ['speed', 'pricing', 'support', 'reports'] });
    expect(body.comment).toHaveLength(500);
    expect(body.supportIssue).toHaveLength(300);
    expect(body.improve).toHaveLength(3);
  });
});

describe('translations', () => {
  const used = new Set<string>(['fb_menu', 'guide_menu', 'fb_title']);
  [OVERALL_OPTIONS, SUPPORT_CHOICES, PRICING_CHOICES, RENEW_CHOICES, IMPROVE_CHOICES].forEach((l) => l.forEach((o) => used.add(o.labelKey)));
  ASPECT_ROWS.forEach((a) => { used.add(a.labelKey); used.add(a.hintKey); });
  const fbKeys = Object.keys(EN).filter((k) => k.startsWith('fb_'));
  const ph = (s: string): string => (s.match(/\{\{\w+\}\}/g) ?? []).sort().join(',');

  it('every key the form uses exists in English and Hindi', () => {
    for (const k of used) { expect(EN[k]).toBeTruthy(); expect(HI[k]).toBeTruthy(); }
  });
  it('Hindi has every feedback key, with the same placeholders', () => {
    for (const k of fbKeys) { expect(HI[k]).toBeTruthy(); expect(ph(HI[k])).toBe(ph(EN[k])); }
  });
  it('the screen only asks for keys that exist', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../../features/employer/screens/EmployerFeedbackScreen.tsx'), 'utf8');
    const asked = [...src.matchAll(/t\('((?:fb|guide)_\w+)'/g)].map((m) => m[1]);
    expect(asked.length).toBeGreaterThan(20);
    for (const k of asked) expect(EN[k]).toBeTruthy();
  });
});
