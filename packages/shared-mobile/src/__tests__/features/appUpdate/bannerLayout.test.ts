import { bannerTopPadding, BANNER_TOP_GAP } from '../../../features/appUpdate/bannerLayout';

describe('bannerTopPadding', () => {
  it('pushes the strip below the status bar / notch', () => {
    expect(bannerTopPadding(30)).toBe(30 + BANNER_TOP_GAP);
    expect(bannerTopPadding(47)).toBe(55); // notch phone
  });
  it('still leaves a small gap on devices with no inset, and never goes negative or NaN', () => {
    expect(bannerTopPadding(0)).toBe(BANNER_TOP_GAP);
    expect(bannerTopPadding(-5)).toBe(BANNER_TOP_GAP);
    expect(bannerTopPadding(NaN)).toBe(BANNER_TOP_GAP);
  });
});
