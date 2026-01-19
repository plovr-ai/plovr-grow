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
  OnboardingStepConfig,
} from "@/types/onboarding";

// Service-specific types
export interface CreateTenantWithCompanyInput {
  tenantName: string;
  companySlug: string;
  companyName: string;
  companyLegalName?: string;
  companyDescription?: string;
  companyLogoUrl?: string;
  companyWebsiteUrl?: string;
  companySupportEmail?: string;
  companySupportPhone?: string;
  companyTaxId?: string;
}
