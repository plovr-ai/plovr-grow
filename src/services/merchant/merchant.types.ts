// ==================== Merchant Service Types ====================

import type { CompanySettings } from "@/types/company";
import type { MerchantSettings } from "@/types/merchant";

// ==================== Response Types ====================

export interface MerchantWithCompany {
  id: string;
  slug: string;
  name: string;
  companyId: string;
  description?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  bannerUrl?: string;
  timezone: string;
  currency: string;
  locale: string;
  taxRate: number;
  status: "active" | "inactive" | "temporarily_closed";
  settings?: MerchantSettings;
  company: {
    id: string;
    slug: string;
    tenantId: string;
    name: string;
    settings?: CompanySettings;
    tenant: {
      id: string;
      name: string;
    };
  };
}

export interface CompanyWithMerchants {
  id: string;
  slug: string;
  tenantId: string;
  name: string;
  description?: string;
  logoUrl?: string;
  settings?: CompanySettings;
  tenant: {
    id: string;
    name: string;
  };
  merchants: MerchantWithCompany[];
}
