// Questions + rules for the quarterly employer feedback form in the app. Values must match backend/utils/selfFeedback.js
// (the server only accepts these) and the CRM's constants/selfFeedback.js, so replies from both show up together.
// Labels are i18n keys (employer namespace) — the screen translates them.

export const OVERALL_OPTIONS = [
  { value: 1, emoji: '😞', labelKey: 'fb_overall_1', color: '#EF4444' },
  { value: 2, emoji: '🙁', labelKey: 'fb_overall_2', color: '#F59E0B' },
  { value: 3, emoji: '😐', labelKey: 'fb_overall_3', color: '#94A3B8' },
  { value: 4, emoji: '🙂', labelKey: 'fb_overall_4', color: '#34D399' },
  { value: 5, emoji: '😄', labelKey: 'fb_overall_5', color: '#10B981' },
] as const;

export const ASPECT_ROWS = [
  { key: 'performance', labelKey: 'fb_aspect_performance', hintKey: 'fb_aspect_performance_hint' },
  { key: 'features', labelKey: 'fb_aspect_features', hintKey: 'fb_aspect_features_hint' },
  { key: 'navigation', labelKey: 'fb_aspect_navigation', hintKey: 'fb_aspect_navigation_hint' },
  { key: 'workerResponse', labelKey: 'fb_aspect_workerResponse', hintKey: 'fb_aspect_workerResponse_hint' },
] as const;

export const SUPPORT_CHOICES = [
  { value: 'yes', labelKey: 'fb_yes' },
  { value: 'no', labelKey: 'fb_no' },
  { value: 'not_needed', labelKey: 'fb_notNeeded' },
] as const;

export const PRICING_CHOICES = [
  { value: 'too_high', labelKey: 'fb_price_too_high' },
  { value: 'fair', labelKey: 'fb_price_fair' },
  { value: 'great_value', labelKey: 'fb_price_great_value' },
] as const;

export const RENEW_CHOICES = [
  { value: 'yes', labelKey: 'fb_yes' },
  { value: 'maybe', labelKey: 'fb_maybe' },
  { value: 'no', labelKey: 'fb_no' },
] as const;

export const IMPROVE_CHOICES = [
  { value: 'speed', labelKey: 'fb_imp_speed' },
  { value: 'worker_quality', labelKey: 'fb_imp_worker_quality' },
  { value: 'more_workers', labelKey: 'fb_imp_more_workers' },
  { value: 'pricing', labelKey: 'fb_imp_pricing' },
  { value: 'support', labelKey: 'fb_imp_support' },
  { value: 'features', labelKey: 'fb_imp_features' },
  { value: 'ease_of_use', labelKey: 'fb_imp_ease_of_use' },
  { value: 'reports', labelKey: 'fb_imp_reports' },
  { value: 'app_experience', labelKey: 'fb_imp_app_experience' },
] as const;

export const MAX_IMPROVE = 3;
export const FEEDBACK_STEPS = 3;
/** How long the employer must have the app open before the popup may ask (the CRM waits 10 active minutes). */
export const APP_SECONDS_BEFORE_PROMPT = 5 * 60;

export interface FeedbackDraft {
  overall: number;
  ratings: Record<string, number>;
  supportReceived: string;
  supportIssue: string;
  pricing: string;
  recommend: number | null;
  renewIntent: string;
  improve: string[];
  comment: string;
}

export const emptyDraft = (): FeedbackDraft => ({
  overall: 0, ratings: {}, supportReceived: '', supportIssue: '', pricing: '', recommend: null, renewIntent: '', improve: [], comment: '',
});

/** Every step needs at least one answer before moving on, so nobody taps straight through an empty form. */
export function isStepDone(step: number, d: FeedbackDraft): boolean {
  if (step === 0) return d.overall > 0;
  if (step === 1) return Object.values(d.ratings).some(Boolean) || !!d.supportReceived;
  return !!d.pricing || d.recommend !== null || !!d.renewIntent || d.improve.length > 0;
}

/** Add / remove a "what to improve first" choice, never going over MAX_IMPROVE. */
export function toggleImprove(current: string[], value: string): string[] {
  if (current.includes(value)) return current.filter((x) => x !== value);
  return current.length >= MAX_IMPROVE ? current : [...current, value];
}

/** Set (or clear, when 0) one star rating without mutating the old object. */
export function withRating(ratings: Record<string, number>, key: string, value: number): Record<string, number> {
  const next = { ...ratings };
  if (value) next[key] = value; else delete next[key];
  return next;
}

/** The body sent to the server — support details only make sense for the matching answer. */
export function toSubmitBody(d: FeedbackDraft) {
  const ratings = { ...d.ratings };
  if (d.supportReceived !== 'yes') delete ratings.support;
  return {
    overall: d.overall,
    ratings,
    supportReceived: d.supportReceived,
    supportIssue: d.supportReceived === 'no' ? d.supportIssue.slice(0, 300) : '',
    pricing: d.pricing,
    recommend: d.recommend,
    renewIntent: d.renewIntent,
    improve: d.improve.slice(0, MAX_IMPROVE),
    comment: d.comment.slice(0, 500),
    platform: 'app' as const,
  };
}
