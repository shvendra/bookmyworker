// Turns a failed data-load into a professional one-line REASON, so a
// "Couldn't refresh" banner tells the user WHY (slow internet vs a server
// hiccup vs an expired session) instead of leaving them to guess — and to stop
// them reading a load failure as "there is no data".
//
// The API client (core/api/client.ts) already attaches a human `message` and a
// `statusCode` to every error; this just picks the right line from those.

type Translate = (key: string, opts?: Record<string, unknown>) => string;

interface ErrLike {
  message?: string;
  statusCode?: number;
}

/** First errored query's `.error` from a list of React Query results. */
export function firstQueryError(
  queries: Array<{ isError?: boolean; error?: unknown } | null | undefined>,
): unknown {
  for (const q of queries) {
    if (q && q.isError) return q.error;
  }
  return undefined;
}

/** Professional, localised reason for a load failure. '' when there is no error. */
export function describeLoadError(err: unknown, t: Translate): string {
  if (!err) return '';
  const e = err as ErrLike;
  // No statusCode → the request never reached the server (timeout / offline /
  // DNS). The API client's own message already says "check your connection",
  // but we phrase it reassuringly so the user doesn't think data was lost.
  if (e.statusCode == null) return t('dashboardLoadErrorNet', { ns: 'translation' });
  if (e.statusCode === 401) return t('dashboardLoadErrorAuth', { ns: 'translation' });
  if (e.statusCode >= 500) return t('dashboardLoadErrorServer', { ns: 'translation' });
  // 4xx with a server-provided message — surface it directly.
  return e.message || t('dashboardLoadErrorServer', { ns: 'translation' });
}
