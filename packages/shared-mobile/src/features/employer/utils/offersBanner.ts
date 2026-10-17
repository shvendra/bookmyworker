export type BannerAd = { _id?: string; mediaUrl: string; mediaType: string; link: string; isActive: boolean; targets: string[] };

/** Image promotions SuperAdmin targeted at the Employer app that the user hasn't already closed. */
export const pickBannerAds = (ads: BannerAd[] | undefined, dismissed: string[]): BannerAd[] =>
  (ads ?? []).filter(
    (a) => a.isActive && a.mediaType === 'image' && !!a.mediaUrl && a.targets?.includes('employer_app') && !dismissed.includes(a._id ?? ''),
  );
