import { companyRepository } from "@/repositories/company.repository";
import { merchantRepository } from "@/repositories/merchant.repository";
import prisma from "@/lib/db";
import { AppError, ErrorCodes } from "@/lib/errors";
import type { Prisma } from "@prisma/client";
import type {
  CreateTenantWithCompanyInput,
  CreateCompanyInput,
  UpdateCompanyInput,
  CreateMerchantInput,
} from "./company.types";
import {
  DEFAULT_ONBOARDING_DATA,
  WEBSITE_DEPENDENT_STEPS,
  isOnboardingComplete,
} from "@/types/onboarding";
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
          timezone: input.companyTimezone ?? "America/New_York",
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
      throw new AppError(ErrorCodes.COMPANY_ALREADY_EXISTS, undefined, 409);
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
      timezone: input.timezone ?? "America/New_York",
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
      throw new AppError(ErrorCodes.COMPANY_NOT_FOUND, undefined, 404);
    }

    // Validate slug availability
    const isAvailable = await merchantRepository.isSlugAvailable(input.slug);
    if (!isAvailable) {
      throw new AppError(ErrorCodes.MERCHANT_SLUG_TAKEN, { slug: input.slug }, 409);
    }

    return merchantRepository.create(companyId, company.tenantId, {
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
    if (input.timezone !== undefined) data.timezone = input.timezone;
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
   * Initialize onboarding for a company.
   * For claimed users (source=generator with merchants), website step is auto-completed.
   */
  async initializeOnboarding(tenantId: string, companyId: string) {
    const company = await companyRepository.getById(companyId);

    if (!company) {
      throw new AppError(ErrorCodes.COMPANY_NOT_FOUND, undefined, 404);
    }

    // Only initialize if not started
    if (company.onboardingStatus !== "not_started") {
      return company;
    }

    // Detect claimed user: has source=generator
    const isClaimed =
      (company as Record<string, unknown>).source === "generator";

    const data: OnboardingData = isClaimed
      ? {
          steps: {
            website: { status: "completed", completedAt: new Date().toISOString() },
            gbp: { status: "pending" },
            menu: { status: "pending" },
            stripe: { status: "pending" },
          },
        }
      : { ...DEFAULT_ONBOARDING_DATA };

    return companyRepository.update(companyId, {
      onboardingStatus: "in_progress",
      onboardingData: data as unknown as Prisma.InputJsonValue,
    });
  }

  /**
   * Update a specific onboarding step.
   * When website is completed, unlocks gbp/menu/stripe.
   * When all steps are completed/skipped, marks onboarding as completed.
   */
  async updateOnboardingStep(
    tenantId: string,
    companyId: string,
    stepId: OnboardingStepId,
    status: OnboardingStepStatus
  ) {
    const company = await companyRepository.getById(companyId);

    if (!company) {
      throw new AppError(ErrorCodes.COMPANY_NOT_FOUND, undefined, 404);
    }

    const currentData =
      (company.onboardingData as unknown as OnboardingData) ??
      DEFAULT_ONBOARDING_DATA;

    // Update the target step
    const updatedSteps = { ...currentData.steps };
    updatedSteps[stepId] = {
      status,
      ...(status === "completed" || status === "skipped"
        ? { completedAt: new Date().toISOString() }
        : {}),
    };

    // If website just completed, unlock dependent steps
    if (stepId === "website" && status === "completed") {
      for (const depId of WEBSITE_DEPENDENT_STEPS) {
        if (updatedSteps[depId].status === "locked") {
          updatedSteps[depId] = { status: "pending" };
        }
      }
    }

    const updatedData: OnboardingData = {
      ...currentData,
      steps: updatedSteps,
    };

    // Check if all steps are now finished
    const allFinished = isOnboardingComplete(updatedData);

    return companyRepository.update(companyId, {
      onboardingStatus: allFinished ? "completed" : "in_progress",
      onboardingData: updatedData as unknown as Prisma.InputJsonValue,
      ...(allFinished ? { onboardingCompletedAt: new Date() } : {}),
    });
  }

  /**
   * Get onboarding status and data for a company
   */
  async getOnboardingStatus(tenantId: string, companyId: string) {
    const company = await companyRepository.getById(companyId);

    if (!company) {
      throw new AppError(ErrorCodes.COMPANY_NOT_FOUND, undefined, 404);
    }

    return {
      status: company.onboardingStatus,
      data: company.onboardingData as unknown as OnboardingData | null,
      completedAt: company.onboardingCompletedAt,
    };
  }

  /**
   * Dismiss the onboarding completed bar
   */
  async dismissOnboarding(tenantId: string, companyId: string) {
    const company = await companyRepository.getById(companyId);

    if (!company) {
      throw new AppError(ErrorCodes.COMPANY_NOT_FOUND, undefined, 404);
    }

    const currentData =
      (company.onboardingData as unknown as OnboardingData) ?? DEFAULT_ONBOARDING_DATA;

    return companyRepository.update(companyId, {
      onboardingData: {
        ...currentData,
        dismissedAt: new Date().toISOString(),
      } as unknown as Prisma.InputJsonValue,
    });
  }
}

export const companyService = new CompanyService();
