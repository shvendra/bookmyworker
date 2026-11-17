// Google sign-in mock. Both functions are jest mocks tests configure per case.
export const isGoogleSignInAvailable = jest.fn(() => false);
export const signInWithGoogle = jest.fn();
// Same rule as the real helper (kept as a plain function so jest.clearAllMocks never strips it).
export const googleSignInErrorKey = (error: unknown): 'googleSignInUnavailable' | null => {
  const e = error as { code?: string | number; message?: string } | null;
  return String(e?.code ?? '') === '10' || /DEVELOPER_ERROR/i.test(String(e?.message ?? '')) ? 'googleSignInUnavailable' : null;
};
