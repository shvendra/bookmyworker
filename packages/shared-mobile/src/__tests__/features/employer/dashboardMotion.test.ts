import { agoParts, countUpValue, easeOutCubic, formatIndian } from '../../../shared/components/motion/motionMath';
import { eventMessage, agoText } from '../../../features/employer/utils/livePulseText';
import { normalizeLivePulse } from '../../../core/api/endpoints/livePulseApi';
import { pickBannerAds } from '../../../features/employer/utils/offersBanner';

describe('motionMath', () => {
  it('easeOutCubic is clamped, monotonic and hits both ends', () => {
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(9)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
    expect(easeOutCubic(0.6)).toBeGreaterThan(easeOutCubic(0.4));
  });
  it('countUpValue always lands exactly on the target', () => {
    expect(countUpValue(0, 670695, 0, 900)).toBe(0);
    expect(countUpValue(0, 670695, 900, 900)).toBe(670695);
    expect(countUpValue(0, 670695, 5000, 900)).toBe(670695);
    expect(countUpValue(0, 100, 450, 900)).toBeGreaterThan(50);
    expect(countUpValue(100, 40, 450, 900)).toBeLessThan(100);   // counts down too
    expect(countUpValue(3, 9, 10, 0)).toBe(9);                   // zero duration → straight to target
  });
  it('formatIndian groups digits the Indian way and survives bad input', () => {
    expect(formatIndian(670695)).toBe('6,70,695');
    expect(formatIndian(0)).toBe('0');
    expect(formatIndian(-5)).toBe('0');
    expect(formatIndian(NaN)).toBe('0');
    expect(formatIndian(12.6)).toBe('13');
  });
  it('agoParts buckets minutes / hours / days and treats future or invalid times as "now"', () => {
    const now = Date.parse('2026-10-17T12:00:00Z');
    const ago = (ms: number) => new Date(now - ms).toISOString();
    expect(agoParts(ago(20_000), now)).toEqual({ unit: 'now', n: 0 });
    expect(agoParts(ago(5 * 60_000), now)).toEqual({ unit: 'min', n: 5 });
    expect(agoParts(ago(3 * 3600_000 + 5000), now)).toEqual({ unit: 'hour', n: 3 });
    expect(agoParts(ago(50 * 3600_000), now)).toEqual({ unit: 'day', n: 2 });
    expect(agoParts(new Date(now + 60_000), now).unit).toBe('now');
    expect(agoParts('garbage', now).unit).toBe('now');
    expect(agoParts(null, now).unit).toBe('now');
    expect(agoParts(undefined).unit).toBe('now');
  });
});

describe('livePulseText', () => {
  const t = (k: string, v?: Record<string, unknown>) => `${k}|${JSON.stringify(v ?? {})}`;
  const ev = (type: 'worker' | 'requirement') => ({ type, category: 'x', categoryLabel: 'X', place: 'Pune', at: '2026-10-17T10:00:00Z' });

  it('picks the with-category or generic wording per event type', () => {
    expect(eventMessage(ev('worker'), 'Welder', t)).toContain('lp_evWorker|');
    expect(eventMessage(ev('worker'), '  ', t)).toContain('lp_evWorkerNoCat|');
    expect(eventMessage(ev('requirement'), 'Driver', t)).toContain('lp_evReq|');
    expect(eventMessage(ev('requirement'), '', t)).toContain('lp_evReqNoCat|');
    expect(eventMessage(ev('worker'), ' Welder ', t)).toContain('"category":"Welder"');
    expect(eventMessage(ev('worker'), 'Welder', t)).toContain('"place":"Pune"');
  });
  it('agoText maps every bucket to its key with the count', () => {
    const now = Date.parse('2026-10-17T12:00:00Z');
    const at = (ms: number) => new Date(now - ms).toISOString();
    expect(agoText(at(1000), t, now)).toBe('lp_agoNow|{}');
    expect(agoText(at(7 * 60_000), t, now)).toBe('lp_agoMin|{"count":7}');
    expect(agoText(at(5 * 3600_000), t, now)).toBe('lp_agoHour|{"count":5}');
    expect(agoText(at(3 * 86400_000), t, now)).toBe('lp_agoDay|{"count":3}');
  });
});

describe('normalizeLivePulse', () => {
  it('returns null for anything that is not a data envelope', () => {
    expect(normalizeLivePulse(null)).toBeNull();
    expect(normalizeLivePulse({})).toBeNull();
    expect(normalizeLivePulse({ data: 'x' })).toBeNull();
  });
  it('coerces counts, defaults the scope/place and drops malformed events', () => {
    const out = normalizeLivePulse({ data: {
      scope: 'weird', place: '  ', activeToday: -4, newToday: 'x', requirementsToday: 7.9,
      events: [
        { type: 'requirement', category: 'a', categoryLabel: 'A', place: 'Goa', at: '2026-10-17T00:00:00Z' },
        { type: 'other', place: 'Pune', at: '2026-10-17T00:00:00Z' },
        { type: 'worker', place: '', at: '2026-10-17T00:00:00Z' },
        { type: 'worker', place: 'Pune', at: '' },
        null, 5,
      ],
    } });
    expect(out).toMatchObject({ scope: 'india', place: 'India', activeToday: 0, newToday: 0, requirementsToday: 7 });
    expect(out?.events).toEqual([
      { type: 'requirement', category: 'a', categoryLabel: 'A', place: 'Goa', at: '2026-10-17T00:00:00Z' },
      { type: 'worker', category: '', categoryLabel: '', place: 'Pune', at: '2026-10-17T00:00:00Z' },
    ]);
  });
  it('keeps a valid district scope and tolerates a missing events array', () => {
    expect(normalizeLivePulse({ data: { scope: 'district', place: 'Pune', activeToday: 3 } })).toMatchObject({ scope: 'district', place: 'Pune', activeToday: 3, events: [] });
    expect(normalizeLivePulse({ data: { scope: 'state', place: 'Goa' } })?.scope).toBe('state');
  });
});

describe('pickBannerAds', () => {
  const ad = (o: Record<string, unknown> = {}) => ({ _id: 'a1', mediaUrl: 'https://x/y.png', mediaType: 'image', link: '', isActive: true, targets: ['employer_app'], ...o }) as Parameters<typeof pickBannerAds>[0] extends (infer A)[] | undefined ? A : never;
  it('keeps only active image ads for the employer app that were not dismissed', () => {
    const ads = [ad(), ad({ _id: 'v', mediaType: 'video' }), ad({ _id: 'o', isActive: false }), ad({ _id: 'g', targets: ['agent_app'] }), ad({ _id: 'e', mediaUrl: '' }), ad({ _id: 'd' })];
    expect(pickBannerAds(ads, ['d']).map((a) => a._id)).toEqual(['a1']);
  });
  it('handles missing input and ads without an id or targets', () => {
    expect(pickBannerAds(undefined, [])).toEqual([]);
    expect(pickBannerAds([ad({ _id: undefined })], [])).toHaveLength(1);
    expect(pickBannerAds([ad({ targets: undefined })], [])).toEqual([]);
  });
});

import { maxDiscountPct, highestEmployerType, planExpiredKey } from '../../../features/employer/utils/planExpiredOffer';

describe('planExpiredOffer', () => {
  const pricing = {
    subscription: {
      individual: { '1m': 199, '6m': 999, '12m': 1999 },
      contractor: { '1m': 599, '6m': 2900, '12m': 4999 },
      agency: { '1m': 599, '6m': 2900, '12m': 4999 },
      industry: { '1m': 999, '6m': 3999, '12m': 5999 },
    },
    subscriptionMrp: {
      individual: { '1m': 498, '6m': 1998, '12m': 2999 },
      contractor: { '1m': 1499, '6m': 5800, '12m': 9999 },
      agency: { '1m': 1499, '6m': 5800, '12m': 9999 },
      industry: { '1m': 2499, '6m': 7999, '12m': 11999 },
    },
  } as never;

  it('picks the highest tier held', () => {
    expect(highestEmployerType({ individual: true, industry: true })).toBe('industry');
    expect(highestEmployerType('Contractor')).toBe('contractor');
    expect(highestEmployerType(undefined)).toBe('individual');
  });
  it('returns the best % off for the tier, like the CRM', () => {
    expect(maxDiscountPct({ individual: true }, pricing)).toBe(60); // 199 vs 498
    expect(maxDiscountPct({ industry: true }, pricing)).toBe(60);   // 999 vs 2499
  });
  it('returns null when there is no real discount', () => {
    const none = { subscription: { individual: { '1m': 100, '6m': 100, '12m': 100 } }, subscriptionMrp: { individual: { '1m': 100, '6m': 100, '12m': 100 } } } as never;
    expect(maxDiscountPct({ individual: true }, none)).toBeNull();
    expect(maxDiscountPct({ individual: true }, undefined)).toBeNull();
  });
  it('keys the popup per expiry date', () => {
    expect(planExpiredKey('u1', '2026-01-01T00:00:00Z')).not.toBe(planExpiredKey('u1', '2026-06-01T00:00:00Z'));
  });
});
