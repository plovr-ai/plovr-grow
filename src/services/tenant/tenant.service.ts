import { tenantRepository } from "@/repositories/tenant.repository";
import { merchantRepository } from "@/repositories/merchant.repository";
import { AppError, ErrorCodes } from "@/lib/errors";
import { runInTransaction } from "@/lib/transaction";
import { generateEntityId } from "@/lib/id";
import type { Prisma } from "@prisma/client";
import type { CreateTenantInput, UpdateTenantInput } from "./tenant.types";
import { generateUniqueSlug } from "@/services/generator/slug.util";
import { resolveTemplate } from "@/types/website-template";
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
import type { CreateMerchantInput } from "@/services/merchant/merchant.types";

/** Only display reviews with this rating or higher on the website */
const MIN_DISPLAY_RATING = 4;

/**
 * Create a new tenant
 */
async function createTenant(input: CreateTenantInput) {
  return tenantRepository.create({
    slug: input.slug,
    name: input.name,
    description: input.description,
    logoUrl: input.logoUrl,
    websiteUrl: input.websiteUrl,
    supportEmail: input.supportEmail,
    supportPhone: input.supportPhone,
    currency: input.currency ?? "USD",
    locale: input.locale ?? "en-US",
    timezone: input.timezone ?? "America/New_York",
    settings: input.settings as unknown as Prisma.InputJsonValue,
  });
}

/**
 * Create a new tenant together with its default merchant in a single
 * transaction. Used by both direct Stytch signup and the /generator flow
 * to guarantee that every tenant has at least one merchant from creation.
 *
 * Pass `tx` to participate in an outer transaction (e.g. when the caller
 * also creates a User in the same atomic unit).
 */
async function createTenantWithMerchant(input: {
  name: string;
  source?: "signup" | "generator";
  websiteUrl?: string | null;
  settings?: Record<string, unknown>;
  merchant?: {
    name?: string;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
    phone?: string | null;
    businessHours?: unknown;
  };
  tx?: Prisma.TransactionClient;
}) {
  const tenantSlug = await generateUniqueSlug(
    input.name,
    async (slug) => (await tenantRepository.getBySlug(slug)) === null
  );
  const merchantSlug = await generateUniqueSlug(
    input.name,
    async (slug) => merchantRepository.isSlugAvailable(slug)
  );

  const tenantId = generateEntityId();
  const merchantId = generateEntityId();
  const merchantName = input.merchant?.name ?? input.name;

  const run = async (client: Prisma.TransactionClient) => {
    const tenant = await tenantRepository.create(
      {
        id: tenantId,
        name: input.name,
        slug: tenantSlug,
        websiteUrl: input.websiteUrl ?? undefined,
        settings: input.settings as Prisma.InputJsonValue | undefined,
        source: input.source,
      },
      client
    );

    const merchant = await merchantRepository.create(
      tenantId,
      {
        id: merchantId,
        slug: merchantSlug,
        name: merchantName,
        // status defaults to "active" via the schema. Setting "pending" here
        // would break getBySlugWithMerchants() lookups that the /generator
        // storefront depends on right after markCompleted().
        address: input.merchant?.address ?? null,
        city: input.merchant?.city ?? null,
        state: input.merchant?.state ?? null,
        zipCode: input.merchant?.zipCode ?? null,
        phone: input.merchant?.phone ?? null,
        businessHours: input.merchant?.businessHours as
          | Prisma.InputJsonValue
          | undefined,
      },
      client
    );

    return { tenant, merchant };
  };

  if (input.tx) return run(input.tx);
  return runInTransaction(run);
}

/**
 * Get tenant by ID
 */
async function getTenant(tenantId: string) {
  return tenantRepository.getById(tenantId);
}

/**
 * Get tenant by slug
 */
async function getTenantBySlug(slug: string) {
  return tenantRepository.getBySlug(slug);
}

/**
 * Get tenant with all merchants
 */
async function getTenantWithMerchants(tenantId: string) {
  return tenantRepository.getWithMerchants(tenantId);
}

/**
 * Update tenant details
 */
async function updateTenant(tenantId: string, input: UpdateTenantInput) {
  const data: Prisma.TenantUpdateInput = {};

  if (input.name !== undefined) data.name = input.name;
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
    data.settings = input.settings as unknown as Prisma.InputJsonValue;
  if (input.status !== undefined) data.status = input.status;

  return tenantRepository.update(tenantId, data);
}

/**
 * Soft delete tenant
 */
async function deleteTenant(tenantId: string) {
  return tenantRepository.delete(tenantId);
}

/**
 * Create a new merchant under this tenant.
 */
async function createMerchant(tenantId: string, input: CreateMerchantInput) {
  // Validate tenant exists
  const tenant = await tenantRepository.getById(tenantId);
  if (!tenant) {
    throw new AppError(ErrorCodes.TENANT_NOT_FOUND, undefined, 404);
  }

  // Validate slug availability
  const isAvailable = await merchantRepository.isSlugAvailable(input.slug);
  if (!isAvailable) {
    throw new AppError(
      ErrorCodes.MERCHANT_SLUG_TAKEN,
      { slug: input.slug },
      409
    );
  }

  return merchantRepository.create(tenantId, {
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
 * Get all merchants for a tenant.
 */
async function getMerchants(tenantId: string) {
  return merchantRepository.getByTenantId(tenantId);
}

/**
 * Get active merchants for a tenant.
 */
async function getActiveMerchants(tenantId: string) {
  return merchantRepository.getActiveByTenantId(tenantId);
}

/**
 * Update tenant and its first merchant with Google Places data during onboarding.
 */
async function updateFromPlaceDetails(
  tenantId: string,
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
    primaryType?: string;
    types?: string[];
  }
) {
  const tenant = await tenantRepository.getWithMerchants(tenantId);
  if (!tenant) {
    throw new AppError(ErrorCodes.TENANT_NOT_FOUND, undefined, 404);
  }

  const merchant = tenant.merchants?.[0];
  if (!merchant) {
    throw new AppError(ErrorCodes.MERCHANT_NOT_FOUND, undefined, 404);
  }

  // Generate new slugs based on real restaurant name
  const newTenantSlug = await generateUniqueSlug(
    details.name,
    async (slug) =>
      slug === tenant.slug ||
      (await tenantRepository.getBySlug(slug)) === null
  );
  const newMerchantSlug = await generateUniqueSlug(
    details.name,
    async (slug) =>
      slug === merchant.slug ||
      (await merchantRepository.isSlugAvailable(slug))
  );

  const websiteTemplate = resolveTemplate(details.primaryType, details.types);

  const tenantSettings = {
    ...((tenant.settings as Record<string, unknown>) ?? {}),
    themePreset:
      (tenant.settings as Record<string, unknown>)?.themePreset ?? "blue",
    websiteTemplate,
    website: {
      tagline: "",
      heroImage: "",
      socialLinks: [],
      reviews: details.reviews?.filter((r) => r.rating >= MIN_DISPLAY_RATING).slice(0, 5) ?? [],
    },
  };

  // Update both in a transaction
  await runInTransaction(async (tx) => {
    await tenantRepository.update(
      tenantId,
      {
        name: details.name,
        slug: newTenantSlug,
        websiteUrl: details.websiteUrl,
        settings: tenantSettings as Prisma.InputJsonValue,
        source: "generator",
      },
      tx
    );

    await merchantRepository.update(
      merchant.id,
      {
        name: details.name,
        slug: newMerchantSlug,
        status: "active",
        address: details.address,
        city: details.city,
        state: details.state,
        zipCode: details.zipCode,
        phone: details.phone,
        businessHours: details.businessHours as Prisma.InputJsonValue,
      },
      tx
    );
  });

  return { tenantSlug: newTenantSlug, merchantSlug: newMerchantSlug };
}

// ==================== Onboarding Methods ====================

/**
 * Initialize onboarding for a tenant.
 * For claimed users (source=generator with merchants), website step is auto-completed.
 */
async function initializeOnboarding(tenantId: string) {
  const tenant = await tenantRepository.getById(tenantId);

  if (!tenant) {
    throw new AppError(ErrorCodes.TENANT_NOT_FOUND, undefined, 404);
  }

  // Only initialize if not started
  if (tenant.onboardingStatus !== "not_started") {
    return tenant;
  }

  // Detect claimed user: has source=generator
  const isClaimed = tenant.source === "generator";

  const data: OnboardingData = isClaimed
    ? {
        steps: {
          website: {
            status: "completed",
            completedAt: new Date().toISOString(),
          },
          gbp: { status: "pending" },
          menu: { status: "pending" },
          stripe: { status: "pending" },
        },
      }
    : { ...DEFAULT_ONBOARDING_DATA };

  return tenantRepository.update(tenantId, {
    onboardingStatus: "in_progress",
    onboardingData: data as unknown as Prisma.InputJsonValue,
  });
}

/**
 * Update a specific onboarding step.
 * When website is completed, unlocks gbp/menu/stripe.
 * When all steps are completed/skipped, marks onboarding as completed.
 */
async function updateOnboardingStep(
  tenantId: string,
  stepId: OnboardingStepId,
  status: OnboardingStepStatus
) {
  const tenant = await tenantRepository.getById(tenantId);

  if (!tenant) {
    throw new AppError(ErrorCodes.TENANT_NOT_FOUND, undefined, 404);
  }

  const currentData =
    (tenant.onboardingData as unknown as OnboardingData) ??
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

  return tenantRepository.update(tenantId, {
    onboardingStatus: allFinished ? "completed" : "in_progress",
    onboardingData: updatedData as unknown as Prisma.InputJsonValue,
    ...(allFinished ? { onboardingCompletedAt: new Date() } : {}),
  });
}

/**
 * Get onboarding status and data for a tenant
 */
async function getOnboardingStatus(tenantId: string) {
  const tenant = await tenantRepository.getById(tenantId);

  if (!tenant) {
    throw new AppError(ErrorCodes.TENANT_NOT_FOUND, undefined, 404);
  }

  return {
    status: tenant.onboardingStatus,
    data: tenant.onboardingData as unknown as OnboardingData | null,
    completedAt: tenant.onboardingCompletedAt,
  };
}

/**
 * Dismiss the onboarding completed bar
 */
async function dismissOnboarding(tenantId: string) {
  const tenant = await tenantRepository.getById(tenantId);

  if (!tenant) {
    throw new AppError(ErrorCodes.TENANT_NOT_FOUND, undefined, 404);
  }

  const currentData =
    (tenant.onboardingData as unknown as OnboardingData) ??
    DEFAULT_ONBOARDING_DATA;

  return tenantRepository.update(tenantId, {
    onboardingData: {
      ...currentData,
      dismissedAt: new Date().toISOString(),
    } as unknown as Prisma.InputJsonValue,
  });
}

export const tenantService = {
  createTenant,
  createTenantWithMerchant,
  getTenant,
  getTenantBySlug,
  getTenantWithMerchants,
  updateTenant,
  deleteTenant,
  createMerchant,
  getMerchants,
  getActiveMerchants,
  updateFromPlaceDetails,
  initializeOnboarding,
  updateOnboardingStep,
  getOnboardingStatus,
  dismissOnboarding,
};
