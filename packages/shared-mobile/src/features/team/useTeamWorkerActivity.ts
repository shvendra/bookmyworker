import { useCallback, useEffect, useRef, useState } from 'react';
import { workerApi, type TeamWorkerActivity } from '../../core/api/endpoints/workerApi';

/**
 * What the employer's TEAM did on each listed worker (who viewed the number, who set which call status, and when), so one
 * team member can see what the others already did. Fetched once per worker as the list grows; informational only, so a failure
 * is silent. Accounts without a team simply get an empty map.
 */
export const useTeamWorkerActivity = (ids: string[], enabled: boolean): [Record<string, TeamWorkerActivity>, (id: string) => void] => {
  const [activity, setActivity] = useState<Record<string, TeamWorkerActivity>>({});
  const asked = useRef(new Set<string>());

  const load = useCallback(async (batch: string[]): Promise<void> => {
    try {
      const got = await workerApi.getTeamWorkerActivity(batch);
      setActivity((prev) => {
        const next = { ...prev };
        batch.forEach((id) => { if (got[id]) next[id] = got[id]!; else delete next[id]; });
        return next;
      });
    } catch { /* informational only */ }
  }, []);

  const key = ids.join(',');
  useEffect(() => {
    if (!enabled) return;
    const fresh = ids.filter((id) => id && !asked.current.has(id));
    fresh.forEach((id) => asked.current.add(id));
    for (let i = 0; i < fresh.length; i += 100) void load(fresh.slice(i, i + 100));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, load]);

  const refresh = useCallback((id: string) => { if (enabled && id) void load([id]); }, [enabled, load]);
  return [activity, refresh];
};
