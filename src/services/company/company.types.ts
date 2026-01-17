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
} from "@/types/merchant";

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
