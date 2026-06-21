// In-app review util mock — keeps native modules (expo-store-review,
// async-storage) out of the test runtime. Both functions are no-op jest mocks
// so screens that fire a review prompt on success can be tested without crashing.
export const requestReviewOnce = jest.fn(() => Promise.resolve());
export const hasRequestedReview = jest.fn(() => Promise.resolve(false));
