import type { CrossAppTarget } from '../../features/auth/components/WrongAppNotice';

// The two BookMyWorker consumer apps. Kept in one place so the login screens,
// the "wrong app" notice and any future redirect all agree on names + links.
// These MUST match the backend's CROSS_APP map (controllers/userController.js).
export const WORKER_APP: CrossAppTarget = {
  kind: 'worker',
  name: 'BookMyWorker Jobs',
  tagline: 'Search & apply for jobs',
  androidPackage: 'com.app.myworker',
  playStoreUrl: 'https://play.google.com/store/apps/details?id=com.app.myworker',
};

export const EMPLOYER_APP: CrossAppTarget = {
  kind: 'employer',
  name: 'BookMyWorker Employer',
  tagline: 'Post requirements & hire workers',
  androidPackage: 'com.bookmyworkers.employer',
  playStoreUrl: 'https://play.google.com/store/apps/details?id=com.bookmyworkers.employer',
};

/** The app a given role belongs to. */
export const appForRole = (role?: string | null): CrossAppTarget => {
  const r = String(role || '').trim().toLowerCase();
  return r === 'employer' ? EMPLOYER_APP : WORKER_APP;
};

export interface WrongAppInfo {
  registeredRole?: string | null;
  correctApp?: CrossAppTarget | null;
  message?: string | null;
}

/**
 * Extract cross-app guidance from a rejected login error. Returns null unless
 * the server flagged it (`code === "WRONG_APP"`). Falls back to deriving the
 * target app from `registeredRole` when the server didn't send `correctApp`
 * (older backend build).
 */
export const parseWrongApp = (error: unknown): WrongAppInfo | null => {
  const e = error as {
    code?: string;
    message?: string;
    data?: { code?: string; message?: string; registeredRole?: string; correctApp?: CrossAppTarget };
    response?: { data?: { code?: string; message?: string; registeredRole?: string; correctApp?: CrossAppTarget } };
  };
  const body = e?.data ?? e?.response?.data;
  const code = e?.code ?? body?.code;
  if (code !== 'WRONG_APP') return null;
  const registeredRole = body?.registeredRole ?? null;
  return {
    registeredRole,
    correctApp: body?.correctApp ?? (registeredRole ? appForRole(registeredRole) : null),
    message: body?.message ?? e?.message ?? null,
  };
};
