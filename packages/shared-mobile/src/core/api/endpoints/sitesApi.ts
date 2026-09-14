import { apiClient } from '../client';

// ── Types ─────────────────────────────────────────────────────────────────────
// Mirrors backend/models/Site.js. See backend/controllers/siteController.js.

export interface SiteAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

export type SiteType = 'Factory' | 'Warehouse' | 'Shop' | 'Office' | 'ConstructionSite' | 'Other';
export type SiteStatus = 'Active' | 'Inactive';

export interface Site {
  _id: string;
  clientCompanyId: string;
  siteName: string;
  siteType: SiteType;
  address?: SiteAddress;
  siteContactName?: string;
  siteContactPhone?: string;
  shiftPattern?: string;
  status: SiteStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateSitePayload {
  siteName: string;
  siteType?: SiteType;
  address?: SiteAddress;
  siteContactName?: string;
  siteContactPhone?: string;
  shiftPattern?: string;
}

// ── API methods ───────────────────────────────────────────────────────────────

export const sitesApi = {
  // Employer self-service — resolves the caller's own Client Company
  // server-side and returns only that company's Active sites, newest-name-first.
  // See getMySites in backend/controllers/siteController.js.
  getMySites: () =>
    apiClient
      .get<{ success: boolean; sites: Site[] }>('/api/v1/sites/mine')
      .then((r) => r.data.sites ?? []),

  // Employer self-service create — never accepts a clientCompanyId from the
  // body, it's resolved from the session server-side. Defaults to Active/Other.
  // See createMySite in backend/controllers/siteController.js.
  createMySite: (payload: CreateSitePayload) =>
    apiClient
      .post<{ success: boolean; site: Site }>('/api/v1/sites/mine', payload)
      .then((r) => r.data.site),
};
