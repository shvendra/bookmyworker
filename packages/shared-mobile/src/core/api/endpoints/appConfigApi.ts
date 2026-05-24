import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';

export interface AppConfig {
  brand: {
    appLogo:      string;
    logoAltText:  string;
    companyName:  string;
  };
  contact: {
    supportEmail:   string;
    businessEmail:  string;
    primaryPhone:   string;
    secondaryPhone: string;
    whatsappNumber: string;
    gstNumber:      string;
    companyAddress: string;
    officeStreet:   string;
    officeCity:     string;
    officeState:    string;
    officeZip:      string;
  };
  legal: {
    privacyPolicyText: string;
    privacyPolicyLink: string;
    termsText:         string;
    termsLink:         string;
    refundPolicyText:  string;
    refundPolicyLink:  string;
  };
  stats: {
    workerCount:      number;
    agentCount:       number;
    employerCount:    number;
    requirementCount: number;
  };
}

export function formatStat(n: number): string {
  if (n >= 100000) {
    const val = n / 100000;
    return `${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)}L+`;
  }
  if (n >= 1000) {
    const val = n / 1000;
    return `${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)}K+`;
  }
  return `${n}+`;
}

const DEFAULTS: AppConfig = {
  brand: {
    appLogo:     '',
    logoAltText: 'BookMyWorker Logo',
    companyName: 'BookMyWorker',
  },
  contact: {
    supportEmail:   'support@bookmyworkers.com',
    businessEmail:  'info@bookmyworkers.com',
    primaryPhone:   '+917389791873',
    secondaryPhone: '+917089788929',
    whatsappNumber: '+917389791873',
    gstNumber:      '23NBJPS3070R1ZQ',
    companyAddress: 'KHASARA NO 34/1/33, Karahiya, Rewa, Madhya Pradesh 486001, India',
    officeStreet:   'Karahiya',
    officeCity:     'Rewa',
    officeState:    'Madhya Pradesh',
    officeZip:      '486001',
  },
  legal: {
    privacyPolicyText: '',
    privacyPolicyLink: '',
    termsText:         '',
    termsLink:         '',
    refundPolicyText:  '',
    refundPolicyLink:  '',
  },
  stats: {
    workerCount:      600000,
    agentCount:       10000,
    employerCount:    8000,
    requirementCount: 56000,
  },
};

async function fetchAppConfig(): Promise<AppConfig> {
  const res = await apiClient.get<{ success: boolean; data: Record<string, unknown> }>('/api/v1/settings/public');
  const d = res.data?.data ?? {};
  const b = (d.brand   ?? {}) as Record<string, string>;
  const c = (d.contact ?? {}) as Record<string, string>;
  const l = (d.legal   ?? {}) as Record<string, string>;
  const ps = (d.platformStats ?? {}) as Record<string, number>;
  return {
    brand: {
      appLogo:     b.appLogo     || '',
      logoAltText: b.logoAltText || DEFAULTS.brand.logoAltText,
      companyName: b.companyName || DEFAULTS.brand.companyName,
    },
    contact: {
      supportEmail:   c.supportEmail   || DEFAULTS.contact.supportEmail,
      businessEmail:  c.businessEmail  || DEFAULTS.contact.businessEmail,
      primaryPhone:   c.primaryPhone   || DEFAULTS.contact.primaryPhone,
      secondaryPhone: c.secondaryPhone || DEFAULTS.contact.secondaryPhone,
      whatsappNumber: c.whatsappNumber || c.primaryPhone || DEFAULTS.contact.whatsappNumber,
      gstNumber:      c.gstNumber      || DEFAULTS.contact.gstNumber,
      companyAddress: c.companyAddress || DEFAULTS.contact.companyAddress,
      officeStreet:   ((c as any).officeAddress?.street  ?? DEFAULTS.contact.officeStreet),
      officeCity:     ((c as any).officeAddress?.city    ?? DEFAULTS.contact.officeCity),
      officeState:    ((c as any).officeAddress?.state   ?? DEFAULTS.contact.officeState),
      officeZip:      ((c as any).officeAddress?.zipCode ?? DEFAULTS.contact.officeZip),
    },
    legal: {
      privacyPolicyText: l.privacyPolicyText || '',
      privacyPolicyLink: l.privacyPolicyLink || '',
      termsText:         l.termsText         || '',
      termsLink:         l.termsLink         || '',
      refundPolicyText:  l.refundPolicyText  || '',
      refundPolicyLink:  l.refundPolicyLink  || '',
    },
    stats: {
      workerCount:      ps.workers      ?? DEFAULTS.stats.workerCount,
      agentCount:       ps.agents       ?? DEFAULTS.stats.agentCount,
      employerCount:    ps.employers    ?? DEFAULTS.stats.employerCount,
      requirementCount: ps.requirements ?? DEFAULTS.stats.requirementCount,
    },
  };
}

export function useAppConfig() {
  const query = useQuery({
    queryKey: ['app-config'],
    queryFn:  fetchAppConfig,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  return { config: query.data ?? DEFAULTS, isLoading: query.isLoading };
}
