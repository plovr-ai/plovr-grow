// Re-export types from central location
export type {
  CompanyInfo,
  CompanyStatus,
  CompanySettings,
  CompanyWithMerchants,
  MerchantSummary,
  CreateCompanyInput,
  UpdateCompanyInput,
} from "@/types/company";

export type {
  CreateMerchantInput,
  UpdateMerchantInput,
} from "@/services/merchant/merchant.types";

export type {
  OnboardingStatus,
  OnboardingStepId,
  OnboardingStepStatus,
  OnboardingData,
} from "@/types/onboarding";

// Service-specific types
export interface CreateTenantWithCompanyInput {
  // Tenant
  tenantName?: string;
  subscriptionStatus?: string;
  // Company
  companyName: string;
  companySlug?: string; // auto-generated if omitted
  companyWebsiteUrl?: string;
  companySettings?: Record<string, unknown>;
  companyCurrency?: string;
  companyLocale?: string;
  companyTimezone?: string;
  source?: string;
  // Merchant (defaults to companyName if omitted)
  merchantName?: string;
  merchantAddress?: string;
  merchantCity?: string;
  merchantState?: string;
  merchantZipCode?: string;
  merchantPhone?: string;
  merchantBusinessHours?: unknown;
}
