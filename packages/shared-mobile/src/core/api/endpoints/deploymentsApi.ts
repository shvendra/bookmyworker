import { apiClient } from '../client';

// ── Types ─────────────────────────────────────────────────────────────────────
// Mirrors backend/models/Deployment.js. See backend/controllers/deploymentController.js.

export type DeploymentStatus =
  | 'Proposed'
  | 'Confirmed'
  | 'Deployed'
  | 'Active'
  | 'Inactive'
  | 'Replaced'
  | 'Completed'
  | 'Rejected'
  | 'Withdrawn'
  | 'Terminated';

export interface PoliceVerificationSummary {
  status: string;
  reportFileUrl?: string;
}

// Employer-facing shape (sanitizeDeploymentForEmployer in
// deploymentController.js): workerPayRate, workerPayModel, and
// eligibilityOverride are stripped server-side before this ever reaches the
// Employer app. Per the plan's non-negotiable rule, mobile screens must never
// assume or render a worker-pay-rate field even if one ever leaked through.
export interface Deployment {
  _id: string;
  requirementId: string;
  clientCompanyId: string;
  siteId: string;
  workerId: string;
  workerName: string;
  workerPhone: string;
  employerBillingRate: number;
  billingPayModel: 'Monthly' | 'Daily' | 'Hourly';
  payrollModel: 'BMW_Payroll' | 'Direct_Payroll';
  proposedDate?: string;
  deploymentStartDate?: string;
  deploymentEndDate?: string;
  status: DeploymentStatus;
  employerConfirmedBy?: string;
  employerConfirmationNote?: string;
  replacementOfDeploymentId?: string;
  replacementReason?: string | null;
  endReason?: string | null;
  notes?: string;
  // Only present on the employer-owner listing (listDeploymentsForRequirement) —
  // CRM's own listing gets the raw deployment without these.
  kycStatus?: 'Verified' | 'Pending';
  policeVerification?: PoliceVerificationSummary;
  createdAt?: string;
  updatedAt?: string;
}

// ── API methods ───────────────────────────────────────────────────────────────

export const deploymentsApi = {
  // Owner Employer OR CRM (inline check server-side). The Employer-owner path
  // additionally attaches kycStatus + policeVerification per worker.
  // See listDeploymentsForRequirement in backend/controllers/deploymentController.js.
  listForRequirement: (requirementId: string) =>
    apiClient
      .get<{ success: boolean; deployments: Deployment[] }>('/api/v1/deployments', { params: { requirementId } })
      .then((r) => r.data.deployments ?? []),

  // Employer-owner (or CRM on the employer's behalf) — only reachable while
  // the deployment is Proposed.
  confirm: (id: string) =>
    apiClient
      .put<{ success: boolean; deployment: Deployment }>(`/api/v1/deployments/${id}/confirm`, {})
      .then((r) => r.data.deployment),

  // Same access rule as confirm. `reason` is optional free text stored on
  // deployment.notes server-side.
  reject: (id: string, reason?: string) =>
    apiClient
      .put<{ success: boolean; deployment: Deployment }>(
        `/api/v1/deployments/${id}/reject`,
        reason ? { reason } : {},
      )
      .then((r) => r.data.deployment),
};
