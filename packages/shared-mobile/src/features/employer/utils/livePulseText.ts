import type { LivePulseEvent } from '../../../core/api/endpoints/livePulseApi';
import { agoParts } from '../../../shared/components/motion/motionMath';

type Translate = (key: string, vars?: Record<string, unknown>) => string;

/** "New Welder joined in Pune" / "New requirement for Driver in Mumbai" — generic wording when the category is unknown. */
export function eventMessage(e: LivePulseEvent, categoryLabel: string, t: Translate): string {
  const category = categoryLabel.trim();
  const vars = { category, place: e.place };
  if (e.type === 'requirement') return t(category ? 'lp_evReq' : 'lp_evReqNoCat', vars);
  return t(category ? 'lp_evWorker' : 'lp_evWorkerNoCat', vars);
}

/** "just now" / "5 min ago" / "3h ago" / "2d ago". */
export function agoText(at: string, t: Translate, now: number = Date.now()): string {
  const { unit, n } = agoParts(at, now);
  if (unit === 'min') return t('lp_agoMin', { count: n });
  if (unit === 'hour') return t('lp_agoHour', { count: n });
  if (unit === 'day') return t('lp_agoDay', { count: n });
  return t('lp_agoNow');
}
