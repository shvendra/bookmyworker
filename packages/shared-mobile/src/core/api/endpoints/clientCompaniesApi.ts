import { apiClient } from '../client';

// ── Types ─────────────────────────────────────────────────────────────────────
// Mirrors backend/models/ClientCompany.js. See backend/controllers/clientCompanyController.js.

export interface RegisteredAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

export type PayrollModel = 'BMW_Payroll' | 'Direct_Payroll';
export type ServiceChargeBasis = 'FlatFeePerWorker' | 'PercentOfSalary';
export type ClientCompanyStatus = 'Onboarding' | 'Active' | 'Suspended' | 'Closed';

export interface ClientCompany {
  _id: string;
  legalName: string;
  tradeName?: string;
  industryType?: string;
  gstNumber?: string;
  panNumber?: string;
  registeredAddress?: RegisteredAddress;
  primaryContactUserId: string;
  primaryContactName?: string;
  primaryContactPhone?: string;
  primaryContactEmail?: string;
  accountOwnerAdminId?: string;
  accountOwnerName?: string;
  accountOwnerPhone?: string;
  payrollModelDefault: PayrollModel;
  serviceChargeBasis?: ServiceChargeBasis;
  serviceChargeValue?: number;
  creditTermsDays?: number;
  creditBalance?: number;
  status: ClientCompanyStatus;
  createdAt?: string;
  updatedAt?: string;
}

// ── API methods ───────────────────────────────────────────────────────────────

export const clientCompaniesApi = {
  // Resolves the caller's OWN linked Client Company (server-side, from the
  // JWT user — never accepts a company id from the client). Returns null
  // when the employer has no linked company yet — this is the gate for
  // whether to show the Workforce Management feature at all.
  // See getMyClientCompany in backend/controllers/clientCompanyController.js.
  getMyCompany: () =>
    apiClient
      .get<{ success: boolean; clientCompany: ClientCompany | null }>('/api/v1/client-companies/me')
      .then((r) => r.data.clientCompany ?? null),
};
