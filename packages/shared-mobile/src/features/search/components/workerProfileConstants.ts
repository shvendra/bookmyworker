import type { MappingStatus } from '../../../core/api/endpoints/workerMappingApi';

// ─── Full user profile interface ──────────────────────────────────────────────
export interface FullUserProfile {
  isSubscribed?: boolean;
  subscriptionExpery?: string;
  remainingContacts?: number;
  freeContactsRemaining?: number;
  employerType?: string;
  planFeatures?: { inviteEnabled?: boolean; pipelineEnabled?: boolean };
}

// ─── Status meta ──────────────────────────────────────────────────────────────
export const STATUS_META: Record<MappingStatus, { labelKey: string; color: string; bg: string }> = {
  Shortlisted: { labelKey: 'wp_actShortlist',  color: '#2563eb', bg: '#eff6ff' },
  Selected:    { labelKey: 'wp_actSelect',     color: '#6d28d9', bg: '#f5f3ff' },
  Joined:      { labelKey: 'wp_actMarkJoined', color: '#15803d', bg: '#f0fdf4' },
};

// Mirrors the backend's ALLOWED_TRANSITIONS (workerMappingController.js): a worker
// can only advance Shortlisted → Selected → Joined. A requirement is only actionable
// from a given sheet if the target status is a valid *forward* move from the worker's
// current status (or the worker isn't mapped to it yet).
export const FORWARD_TRANSITIONS: Record<MappingStatus, MappingStatus[]> = {
  Shortlisted: ['Selected'],
  Selected:    ['Joined'],
  Joined:      [],
};

// Requirement's own hiring status → translation key (covers all 11 languages).
export const REQ_STATUS_KEY: Record<string, string> = {
  Pending:  'rd_statusPending',
  Active:   'wp_reqStatus_Active',
  Assigned: 'rd_assignedBadge',
};

// i18n key for a worker's existing mapping status badge.
export const MAPPING_STATUS_KEY: Record<MappingStatus, string> = {
  Shortlisted: 'rd_status_Shortlisted',
  Selected:    'rd_status_Selected',
  Joined:      'rd_status_Joined',
};

// Gender raw value → translation key (covers all 11 languages via ws_male/female/other).
export const GENDER_KEY: Record<string, string> = {
  male:   'ws_male',
  female: 'ws_female',
  other:  'ws_other',
};
