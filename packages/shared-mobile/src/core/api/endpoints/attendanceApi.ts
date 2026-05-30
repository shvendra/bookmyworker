import { apiClient } from '../client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AttendanceRecord {
  _id: string;
  requirementId: string;
  mappingId: string;
  employerId: string;
  workerName: string;
  workerPhone: string;
  date: string;         // ISO string — midnight UTC
  present: boolean;
  note?: string;
  agreedRate?: number | null;
  rateType?: 'Daily' | 'Monthly' | null;
  createdAt: string;
  updatedAt: string;
}

export interface JoinedWorker {
  _id: string;          // mappingId
  workerName: string;
  workerPhone: string;
  agreedRate?: number | null;
  rateType?: 'Daily' | 'Monthly' | null;
  joinedDate?: string | null;
}

export interface MarkDayRecord {
  mappingId: string;
  present: boolean;
  note?: string;
}

export interface WorkerSummary {
  mappingId: string;
  workerName: string;
  workerPhone: string;
  agreedRate: number;
  rateType: 'Daily' | 'Monthly';
  joinedDate?: string | null;
  totalDaysMarked: number;
  daysPresent: number;
  daysAbsent: number;
  estimatedSalary: number;
}

// ── API methods ───────────────────────────────────────────────────────────────

export const attendanceApi = {
  // Bulk mark attendance for a requirement on a specific date.
  // date: 'YYYY-MM-DD' string
  markDay: (requirementId: string, date: string, records: MarkDayRecord[]) =>
    apiClient
      .post<{ success: boolean; message: string; date: string }>(
        '/api/v1/attendance/employer/mark',
        { requirementId, date, records }
      )
      .then((r) => r.data),

  // Fetch all attendance records + list of currently Joined workers for a requirement.
  getByRequirement: (requirementId: string) =>
    apiClient
      .get<{ success: boolean; records: AttendanceRecord[]; joinedWorkers: JoinedWorker[] }>(
        `/api/v1/attendance/employer/requirement/${requirementId}`
      )
      .then((r) => r.data),

  // Per-worker salary summary for a requirement.
  getSummary: (requirementId: string) =>
    apiClient
      .get<{ success: boolean; summary: WorkerSummary[]; grandTotal: number }>(
        `/api/v1/attendance/employer/summary/${requirementId}`
      )
      .then((r) => r.data),
};
