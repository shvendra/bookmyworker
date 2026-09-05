import { apiClient } from '../client';

// Logs a Get Help search that found zero matching topics — the feedback
// loop that lets a SuperAdmin see real content gaps (CRM → Settings → Help
// Center → Search Gaps) instead of guessing what to add. Fire-and-forget:
// never awaited by the caller in a way that could block the search UI, and
// failures are swallowed since a missed log is not worth surfacing an error.
export const helpSearchApi = {
  logMiss: (query: string): void => {
    apiClient.post('/api/v1/help-search/miss', { query, audience: 'customer' }).catch(() => {});
  },
};
