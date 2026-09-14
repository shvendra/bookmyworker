import { apiClient } from '../client';

// ── Types ─────────────────────────────────────────────────────────────────────
// Mirrors backend/models/PayrollCycle.js + backend/models/DeploymentAttendance.js.
// See backend/controllers/deploymentAttendanceController.js.
//
// SCOPE: this module intentionally only wraps the three Employer-reachable
// routes (getCycle, submitSummary, list). Daily attendance entry, cycle
// lock/unlock, and correction-approval are CRM-only server-side
// (requireWorkforceAccess-gated) — mobile must never call them, so no
// functions for them exist here by design.

export type PayrollCycleStatus = 'Open' | 'Computed' | 'Approved' | 'Released' | 'Locked';

export interface PayrollCycle {
  _id: string;
  clientCompanyId: string;
  periodStart: string;
  periodEnd: string;
  cycleType: 'Monthly';
  status: PayrollCycleStatus;
  createdAt?: string;
  updatedAt?: string;
}

export type DailyAttendanceStatus = 'Present' | 'Absent' | 'HalfDay' | 'PaidLeave' | 'UnpaidLeave' | 'Off';

export interface DeploymentAttendanceRecord {
  _id: string;
  deploymentId: string;
  cycleId: string;
  entryMode: 'Summary' | 'Daily';
  date?: string;
  status?: DailyAttendanceStatus;
  daysPresent?: number;
  hoursWorked?: number;
  overtimeHours?: number;
  reportedBy?: string;
  remarks?: string;
  correctionOf?: string;
  correctionApprovedBy?: string;
  enteredBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SubmitAttendanceSummaryPayload {
  deploymentId: string;
  month: string; // 'YYYY-MM'
  daysPresent?: number;
  hoursWorked?: number;
  overtimeHours?: number;
  reportedBy?: string;
  remarks?: string;
}

// recordSummaryAttendance's response shape varies by branch: a normal
// create/update returns { success, attendance }; if the cycle is Locked and
// an entry already exists, it instead returns 201 with { success, correction,
// message } (a pending-approval correction, not applied yet). Callers should
// check which field is present rather than assuming `attendance`.
export interface SubmitAttendanceSummaryResponse {
  success: boolean;
  attendance?: DeploymentAttendanceRecord;
  correction?: DeploymentAttendanceRecord;
  message?: string;
}

// ── API methods ───────────────────────────────────────────────────────────────

export const deploymentAttendanceApi = {
  // Gets (or lazily creates) the Monthly PayrollCycle for a company+month.
  // Employer caller is restricted server-side to their OWN company.
  getCycle: (clientCompanyId: string, month: string) =>
    apiClient
      .get<{ success: boolean; cycle: PayrollCycle }>('/api/v1/deployment-attendance/cycle', {
        params: { clientCompanyId, month },
      })
      .then((r) => r.data.cycle),

  // Employer-allowed. Summary entries only — see SCOPE note above.
  submitSummary: (payload: SubmitAttendanceSummaryPayload) =>
    apiClient
      .post<SubmitAttendanceSummaryResponse>('/api/v1/deployment-attendance/summary', payload)
      .then((r) => r.data),

  list: (deploymentId: string, cycleId?: string) =>
    apiClient
      .get<{ success: boolean; records: DeploymentAttendanceRecord[] }>('/api/v1/deployment-attendance', {
        params: cycleId ? { deploymentId, cycleId } : { deploymentId },
      })
      .then((r) => r.data.records ?? []),
};
