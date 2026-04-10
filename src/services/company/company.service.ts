import { companyRepository } from "@/repositories/company.repository";
import { merchantRepository } from "@/repositories/merchant.repository";
import prisma from "@/lib/db";
import { generateEntityId } from "@/lib/id";
import { generateUniqueSlug } from "@/services/generator/slug.util";
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
   * Create a new tenant with company and default merchant.
   * This is the single entry point for creating a new business entity —
   * used by both auth registration and the landing page generator.
   */
  async createTenantWithCompanyAndMerchant(input: CreateTenantWithCompanyInput) {
    const tenantId = generateEntityId();
    const companyId = generateEntityId();
    const merchantId = generateEntityId();

    // Generate unique slugs before the transaction
    const companySlug = input.companySlug ?? await generateUniqueSlug(
      input.companyName,
      async (slug) => (await companyRepository.getBySlug(slug)) === null
    );
    const merchantSlug = await generateUniqueSlug(
      input.merchantName ?? input.companyName,
      async (slug) => merchantRepository.isSlugAvailable(slug)
    );

    return prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          id: tenantId,
          name: input.tenantName ?? input.companyName,
          subscriptionStatus: input.subscriptionStatus ?? "inactive",
        },
      });

      const company = await tx.company.create({
        data: {
          id: companyId,
          tenantId,
          slug: companySlug,
          name: input.companyName,
          websiteUrl: input.companyWebsiteUrl,
          settings: input.companySettings as Prisma.InputJsonValue,
          source: input.source,
          currency: input.companyCurrency ?? "USD",
          locale: input.companyLocale ?? "en-US",
          timezone: input.companyTimezone ?? "America/New_York",
        },
      });

      const merchant = await tx.merchant.create({
        data: {
          id: merchantId,
          tenantId,
          companyId,
          slug: merchantSlug,
          name: input.merchantName ?? input.companyName,
          address: input.merchantAddress,
          city: input.merchantCity,
          state: input.merchantState,
          zipCode: input.merchantZipCode,
          phone: input.merchantPhone,
          businessHours: input.merchantBusinessHours as Prisma.InputJsonValue,
          status: "active",
        },
      });

      return { tenant, company, merchant, companySlug, merchantSlug };
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

  // ==================== Onboarding: Website Setup ====================

  /**
   * Update Company + Merchant from Google Places data.
   * Used during onboarding Step 1 (Website) for users who already have
   * a placeholder Company/Merchant from registration.
   */
  async updateFromPlaceDetails(
    tenantId: string,
    companyId: string,
    details: {
      name: string;
      address: string;
      city: string;
      state: string;
      zipCode: string;
      phone?: string;
      websiteUrl?: string;
      businessHours?: unknown;
      reviews?: Array<{ author: string; rating: number; text: string }>;
    }
  ) {
    const company = await companyRepository.getWithMerchants(companyId);
    if (!company) {
      throw new AppError(ErrorCodes.COMPANY_NOT_FOUND, undefined, 404);
    }

    const merchant = company.merchants?.[0];
    if (!merchant) {
      throw new AppError(ErrorCodes.MERCHANT_NOT_FOUND, undefined, 404);
    }

    // Generate new slugs based on real restaurant name
    const newCompanySlug = await generateUniqueSlug(
      details.name,
      async (slug) =>
        slug === company.slug || (await companyRepository.getBySlug(slug)) === null
    );
    const newMerchantSlug = await generateUniqueSlug(
      details.name,
      async (slug) =>
        slug === merchant.slug || (await merchantRepository.isSlugAvailable(slug))
    );

    const companySettings = {
      ...(company.settings as Record<string, unknown> ?? {}),
      themePreset: (company.settings as Record<string, unknown>)?.themePreset ?? "blue",
      website: {
        tagline: "",
        heroImage: "",
        socialLinks: [],
        reviews: details.reviews?.slice(0, 5) ?? [],
      },
    };

    // Update both in a transaction
    await prisma.$transaction(async (tx) => {
      await tx.company.update({
        where: { id: companyId },
        data: {
          name: details.name,
          slug: newCompanySlug,
          websiteUrl: details.websiteUrl,
          settings: companySettings as Prisma.InputJsonValue,
          source: "generator",
        },
      });

      await tx.merchant.update({
        where: { id: merchant.id },
        data: {
          name: details.name,
          slug: newMerchantSlug,
          address: details.address,
          city: details.city,
          state: details.state,
          zipCode: details.zipCode,
          phone: details.phone,
          businessHours: details.businessHours as Prisma.InputJsonValue,
        },
      });

      // Update tenant name too
      await tx.tenant.update({
        where: { id: tenantId },
        data: { name: details.name },
      });
    });

    return { companySlug: newCompanySlug, merchantSlug: newMerchantSlug };
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
