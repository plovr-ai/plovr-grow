// ==================== Merchant Service Types ====================

import type { CompanySettings } from "@/types/company";
import type { MerchantSettings, BusinessHoursMap } from "@/types/merchant";

// Re-export input types from @/types/merchant for service layer
export type {
  CreateMerchantInput,
  UpdateMerchantInput,
  UpdateMerchantSettingsInput,
  GetMerchantsFilter,
  WebsiteMerchantData,
} from "@/types/merchant";

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
  businessHours?: BusinessHoursMap;
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
    logoUrl?: string;
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
