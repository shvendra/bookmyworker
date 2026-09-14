import { apiClient } from '../client';

// ── Types ─────────────────────────────────────────────────────────────────────
// Mirrors backend/models/ClientInvoice.js. See backend/controllers/clientInvoiceController.js.

export type ClientInvoiceStatus = 'Draft' | 'Issued' | 'PartiallyPaid' | 'Paid' | 'Cancelled' | 'Disputed';

export interface ClientInvoiceLineItem {
  deploymentId: string;
  siteId?: string;
  workerName: string;
  description: string;
  units: number;
  rate: number;
  amount: number;
  source: 'Payslip' | 'ServiceCharge';
}

export interface ClientInvoice {
  _id: string;
  invoiceNumber?: string;
  clientCompanyId: string;
  cycleId: string;
  lineItems: ClientInvoiceLineItem[];
  subtotal: number;
  gstRate: number;
  gstAmount: number;
  totalAmount: number;
  dueDate?: string;
  status: ClientInvoiceStatus;
  pdfUrl?: string;
  issuedAt?: string;
  cancelledReason?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ── API methods ───────────────────────────────────────────────────────────────

export const clientInvoicesApi = {
  // Owner Employer OR CRM (inline check server-side). For an Employer caller,
  // the backend forces `status: { $ne: 'Draft' }` — a Draft invoice (still
  // being assembled by Finance) is never visible from this app.
  // See listInvoicesForCompany in backend/controllers/clientInvoiceController.js.
  listMine: (clientCompanyId: string) =>
    apiClient
      .get<{ success: boolean; invoices: ClientInvoice[] }>('/api/v1/client-invoices', {
        params: { clientCompanyId },
      })
      .then((r) => r.data.invoices ?? []),

  // Same access rule; a Draft invoice 403s for a non-CRM caller even by id.
  getById: (id: string) =>
    apiClient
      .get<{ success: boolean; invoice: ClientInvoice }>(`/api/v1/client-invoices/${id}`)
      .then((r) => r.data.invoice),
};
