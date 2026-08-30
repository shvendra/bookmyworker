import { API_ORIGIN } from '../../core/config/env';

export interface JobShareInput {
  requirementId: string;
  jobTitle: string;
  location: string;
  /** e.g. "₹900–₹1400" — amount only, no period suffix */
  salary: string;
  /** "day" | "week" | "month" */
  period: string;
  workers?: number | null;
  /** already-formatted start date, optional */
  startDate?: string | null;
}

export interface JobShareResult {
  message: string;
  url: string;
  title: string;
}

/**
 * The one canonical "share this job" payload for WhatsApp / SMS / etc.
 *
 * The URL points at the public /apply/<id> page — that page renders a rich
 * link-preview card (og:image + title + description) AND routes the tapper into
 * the BookMyWorker app, or to the Play Store with the job pre-loaded. Sharing
 * the bare Play Store link instead gave a generic "app" preview and dropped the
 * job context entirely.
 */
export function buildJobShareMessage(input: JobShareInput): JobShareResult {
  const url = `${API_ORIGIN}/apply/${input.requirementId}`;
  const lines: string[] = [
    `🔔 Job Available: ${input.jobTitle}`,
    `📍 ${input.location}`,
    `💰 ${input.salary} / ${input.period}`,
  ];
  if (input.workers && input.workers > 0) lines.push(`👷 ${input.workers} workers needed`);
  if (input.startDate) lines.push(`📅 Start: ${input.startDate}`);
  lines.push('', '📲 View job details and apply through the BookMyWorker App:', url);
  return { message: lines.join('\n'), url, title: `Job: ${input.jobTitle}` };
}
