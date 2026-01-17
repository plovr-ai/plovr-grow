import type { ThemePresetName } from "./theme";

// ==================== Company Types ====================

export type CompanyStatus = "active" | "inactive" | "suspended";

export interface CompanyInfo {
  id: string;
  tenantId: string;
  slug: string;
  name: string;
  legalName: string | null;
  description: string | null;
  logoUrl: string | null;
  websiteUrl: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  taxId: string | null;
  status: CompanyStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompanySettings {
  // Brand-level default settings (can be overridden by merchants)
  defaultCurrency?: string;
  defaultLocale?: string;
  defaultTimezone?: string;
  // Theme configuration
  themePreset?: ThemePresetName;
}

export interface MerchantSummary {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  state: string | null;
  status: string;
}

export interface CompanyWithMerchants extends CompanyInfo {
  merchants: MerchantSummary[];
}

// ==================== Company Input Types ====================

export interface CreateCompanyInput {
  slug: string;
  name: string;
  legalName?: string;
  description?: string;
  logoUrl?: string;
  websiteUrl?: string;
  supportEmail?: string;
  supportPhone?: string;
  taxId?: string;
  settings?: CompanySettings;
}

export interface UpdateCompanyInput {
  name?: string;
  legalName?: string;
  description?: string;
  logoUrl?: string;
  websiteUrl?: string;
  supportEmail?: string;
  supportPhone?: string;
  taxId?: string;
  settings?: CompanySettings;
  status?: CompanyStatus;
}
