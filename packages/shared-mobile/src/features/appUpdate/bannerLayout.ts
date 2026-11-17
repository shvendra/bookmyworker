/** The app draws edge-to-edge, so the "update available" strip must start below the status bar (clock / battery / notch). */
export const BANNER_TOP_GAP = 8;
export const bannerTopPadding = (insetTop: number): number => Math.max(0, Number(insetTop) || 0) + BANNER_TOP_GAP;
