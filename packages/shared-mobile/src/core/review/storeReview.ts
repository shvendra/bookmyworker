import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import { Linking } from 'react-native';

/**
 * In-app review — ONE TIME EVER.
 *
 * Call `requestReviewOnce()` only at a genuinely POSITIVE moment (worker finished
 * KYC / uploaded photo, employer logged a positive call outcome / shortlisted /
 * selected / joined a worker). After the first attempt we set a permanent flag,
 * so the prompt is NEVER shown again — not on the next action, not on app reopen.
 *
 * Notes / guarantees:
 *  - Google's native In-App Review dialog shows 1–5 stars; we cannot force a
 *    positive rating, only ask at a happy moment so most users rate high.
 *  - The native flow is quota-limited and may silently not appear; per the
 *    user's requirement we still mark it "done" so the user is never re-prompted.
 *  - Fully wrapped in try/catch — a review prompt must never crash the app.
 *  - The flag lives in this app's storage only, so each app (agent / employer)
 *    tracks its own single prompt independently.
 */

const REVIEW_DONE_KEY = 'review_done_v1';

/** Returns true once a review has already been requested on this device. */
export async function hasRequestedReview(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(REVIEW_DONE_KEY)) === 'true';
  } catch {
    return false;
  }
}

/**
 * Ask for a store review exactly once for the lifetime of the install.
 * Safe to call from any success handler; subsequent calls are no-ops.
 */
export async function requestReviewOnce(): Promise<void> {
  try {
    if ((await AsyncStorage.getItem(REVIEW_DONE_KEY)) === 'true') return;

    // Mark done up-front so two quick positive actions can't double-prompt.
    await AsyncStorage.setItem(REVIEW_DONE_KEY, 'true');

    const available = await StoreReview.isAvailableAsync();
    const hasAction = await StoreReview.hasAction();

    if (available && hasAction) {
      // Native in-app dialog (no app switch). Production builds only.
      await StoreReview.requestReview();
      return;
    }

    // Fallback: open this app's own store page (storeUrl auto-detects the
    // running app's package id, so it's correct for both agent & employer).
    const url = await StoreReview.storeUrl();
    if (url) await Linking.openURL(url);
  } catch {
    // never throw from a review prompt
  }
}
