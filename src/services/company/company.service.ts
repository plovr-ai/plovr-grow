import { companyRepository } from "@/repositories/company.repository";
import { merchantRepository } from "@/repositories/merchant.repository";
import prisma from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type {
  CreateTenantWithCompanyInput,
  CreateCompanyInput,
  UpdateCompanyInput,
  CreateMerchantInput,
} from "./company.types";
import { DEFAULT_ONBOARDING_DATA } from "@/types/onboarding";
import type {
  OnboardingStepId,
  OnboardingStepStatus,
  OnboardingData,
} from "@/types/onboarding";

export class CompanyService {
  /**
   * Create a new tenant with company (for new user registration)
   */
  async createTenantWithCompany(input: CreateTenantWithCompanyInput) {
    return prisma.$transaction(async (tx) => {
      // Create tenant (for subscription/billing)
      const tenant = await tx.tenant.create({
        data: {
          id: crypto.randomUUID(),
          name: input.tenantName,
        },
      });

      // Create company (brand)
      const company = await tx.company.create({
        data: {
          id: crypto.randomUUID(),
          tenantId: tenant.id,
          slug: input.companySlug,
          name: input.companyName,
          legalName: input.companyLegalName,
          description: input.companyDescription,
          logoUrl: input.companyLogoUrl,
          websiteUrl: input.companyWebsiteUrl,
          supportEmail: input.companySupportEmail,
          supportPhone: input.companySupportPhone,
          currency: input.companyCurrency ?? "USD",
          locale: input.companyLocale ?? "en-US",
        },
      });

      return { tenant, company };
    });
  }

  /**
   * Create a new company for an existing tenant
   */
  async createCompany(tenantId: string, input: CreateCompanyInput) {
    // Check if tenant already has a company
    const existing = await companyRepository.getByTenantId(tenantId);
    if (existing) {
      throw new Error("Tenant already has a company");
    }

    return companyRepository.create(tenantId, {
      slug: input.slug,
      name: input.name,
      legalName: input.legalName,
      description: input.description,
      logoUrl: input.logoUrl,
      websiteUrl: input.websiteUrl,
      supportEmail: input.supportEmail,
      supportPhone: input.supportPhone,
      currency: input.currency ?? "USD",
      locale: input.locale ?? "en-US",
      settings: input.settings as Prisma.InputJsonValue,
    });
  }

  /**
   * Create a new merchant under a company
   */
  async createMerchant(companyId: string, input: CreateMerchantInput) {
    // Validate company exists
    const company = await companyRepository.getById(companyId);
    if (!company) {
      throw new Error("Company not found");
    }

    // Validate slug availability
    const isAvailable = await merchantRepository.isSlugAvailable(input.slug);
    if (!isAvailable) {
      throw new Error(`Slug "${input.slug}" is already taken`);
    }

    return merchantRepository.create(companyId, {
      slug: input.slug,
      name: input.name,
      description: input.description,
      address: input.address,
      city: input.city,
      state: input.state,
      zipCode: input.zipCode,
      country: input.country ?? "US",
      phone: input.phone,
      email: input.email,
      logoUrl: input.logoUrl,
      bannerUrl: input.bannerUrl,
      businessHours: input.businessHours as unknown as Prisma.InputJsonValue,
      timezone: input.timezone ?? "America/New_York",
      currency: input.currency ?? "USD",
      locale: input.locale ?? "en-US",
      taxRate: input.taxRate ?? 0,
      settings: input.settings as unknown as Prisma.InputJsonValue,
    });
  }

  /**
   * Get company by ID
   */
  async getCompany(companyId: string) {
    return companyRepository.getById(companyId);
  }

  /**
   * Get company by tenant ID
   */
  async getCompanyByTenantId(tenantId: string) {
    return companyRepository.getByTenantId(tenantId);
  }

  /**
   * Get company with all merchants
   */
  async getCompanyWithMerchants(companyId: string) {
    return companyRepository.getWithMerchants(companyId);
  }

  /**
   * Update company details
   */
  async updateCompany(companyId: string, input: UpdateCompanyInput) {
    const data: Prisma.CompanyUpdateInput = {};

    if (input.name !== undefined) data.name = input.name;
    if (input.legalName !== undefined) data.legalName = input.legalName;
    if (input.description !== undefined) data.description = input.description;
    if (input.logoUrl !== undefined) data.logoUrl = input.logoUrl;
    if (input.websiteUrl !== undefined) data.websiteUrl = input.websiteUrl;
    if (input.supportEmail !== undefined)
      data.supportEmail = input.supportEmail;
    if (input.supportPhone !== undefined)
      data.supportPhone = input.supportPhone;
    if (input.currency !== undefined) data.currency = input.currency;
    if (input.locale !== undefined) data.locale = input.locale;
    if (input.settings !== undefined)
      data.settings = input.settings as Prisma.InputJsonValue;
    if (input.status !== undefined) data.status = input.status;

    return companyRepository.update(companyId, data);
  }

  /**
   * Get all merchants for a company
   */
  async getMerchants(companyId: string) {
    return merchantRepository.getByCompanyId(companyId);
  }

  /**
   * Get active merchants for a company
   */
  async getActiveMerchants(companyId: string) {
    return merchantRepository.getActiveByCompanyId(companyId);
  }

  /**
   * Delete company (and all associated merchants)
   */
  async deleteCompany(companyId: string) {
    return companyRepository.delete(companyId);
  }

  // ==================== Onboarding Methods ====================

  /**
   * Get onboarding status and data for a company
   */
  async getOnboardingStatus(companyId: string) {
    const company = await companyRepository.getById(companyId);

    if (!company) {
      throw new Error("Company not found");
    }

    return {
      status: company.onboardingStatus,
      data: company.onboardingData as OnboardingData | null,
      completedAt: company.onboardingCompletedAt,
    };
  }

  /**
   * Initialize onboarding for a company
   * Called when user first accesses the onboarding flow
   */
  async initializeOnboarding(companyId: string) {
    const company = await companyRepository.getById(companyId);

    if (!company) {
      throw new Error("Company not found");
    }

    // Only initialize if not started
    if (company.onboardingStatus !== "not_started") {
      return company;
    }

    return companyRepository.update(companyId, {
      onboardingStatus: "in_progress",
      onboardingData:
        DEFAULT_ONBOARDING_DATA as unknown as Prisma.InputJsonValue,
    });
  }

  /**
   * Update a specific onboarding step
   */
  async updateOnboardingStep(
    companyId: string,
    stepId: OnboardingStepId,
    status: OnboardingStepStatus
  ) {
    const company = await companyRepository.getById(companyId);

    if (!company) {
      throw new Error("Company not found");
    }

    // Get current data or initialize
    const currentData =
      (company.onboardingData as unknown as OnboardingData) || DEFAULT_ONBOARDING_DATA;

    // Update the specific step
    const updatedData: OnboardingData = {
      ...currentData,
      steps: {
        ...currentData.steps,
        [stepId]: {
          status,
          completedAt:
            status === "completed" || status === "skipped"
              ? new Date().toISOString()
              : null,
        },
      },
    };

    // Determine next step
    const stepOrder: OnboardingStepId[] = ["website", "menu", "oo_config"];
    const currentIndex = stepOrder.indexOf(stepId);
    const nextStepId = stepOrder[currentIndex + 1];

    if (nextStepId) {
      updatedData.currentStep = nextStepId;
    }

    return companyRepository.update(companyId, {
      onboardingStatus: "in_progress",
      onboardingData: updatedData as unknown as Prisma.InputJsonValue,
    });
  }

  /**
   * Mark onboarding as completed
   */
  async completeOnboarding(companyId: string) {
    return companyRepository.update(companyId, {
      onboardingStatus: "completed",
      onboardingCompletedAt: new Date(),
    });
  }

  /**
   * Check if company has completed onboarding
   */
  async hasCompletedOnboarding(companyId: string): Promise<boolean> {
    const company = await companyRepository.getById(companyId);
    return company?.onboardingStatus === "completed";
  }
}

export const companyService = new CompanyService();
