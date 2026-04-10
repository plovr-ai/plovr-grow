# Merge Tenant & Company Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the Company model into Tenant, eliminating the 1:1 indirection layer and simplifying the entire codebase.

**Architecture:** Delete the Company model, move its fields into Tenant, remove `companyId` from all 14 child tables, and update all service/repository/API/UI layers to use `tenantId` exclusively. The public URL structure (`/{companySlug}`) remains unchanged.

**Tech Stack:** Prisma ORM, TypeScript, Next.js App Router, NextAuth

**Spec:** `docs/superpowers/specs/2026-04-10-merge-tenant-company-design.md`

---

### Task 1: Update Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Merge Company fields into Tenant model**

Replace the entire `Tenant` model (lines 11–56) with:

```prisma
model Tenant {
  id                      String                 @id
  name                    String
  slug                    String                 @unique
  subscriptionPlan        String                 @default("free") @map("subscription_plan")
  subscriptionStatus      String                 @default("active") @map("subscription_status")
  stripeConnectStatus     String?                @map("stripe_connect_status")
  description             String?                @db.Text
  logoUrl                 String?                @map("logo_url")
  websiteUrl              String?                @map("website_url")
  supportEmail            String?                @map("support_email")
  supportPhone            String?                @map("support_phone")
  currency                String                 @default("USD")
  locale                  String                 @default("en-US")
  timezone                String                 @default("America/New_York")
  settings                Json?
  status                  String                 @default("active")
  onboardingStatus        String                 @default("not_started") @map("onboarding_status")
  onboardingData          Json?                  @map("onboarding_data")
  onboardingCompletedAt   DateTime?              @map("onboarding_completed_at")
  source                  String?
  deleted                 Boolean                @default(false)
  createdAt               DateTime               @default(now()) @map("created_at")
  updatedAt               DateTime               @updatedAt @map("updated_at")
  stripeConnectAccount    StripeConnectAccount?
  menus                   Menu[]
  menuCategories          MenuCategory[]
  menuItems               MenuItem[]
  orders                  Order[]
  users                   User[]
  taxConfigs              TaxConfig[]
  loyaltyConfig           LoyaltyConfig?
  loyaltyMembers          LoyaltyMember[]
  pointTransactions       PointTransaction[]
  otpVerifications        OtpVerification[]
  featuredItems           FeaturedItem[]
  cateringLeads           CateringLead[]
  cateringOrders          CateringOrder[]
  invoices                Invoice[]
  giftCards               GiftCard[]
  giftCardTransactions    GiftCardTransaction[]
  orderSequences          OrderSequence[]
  companyOrderSequences   CompanyOrderSequence[]
  cateringOrderSequences  CateringOrderSequence[]
  invoiceSequences        InvoiceSequence[]
  payments                Payment[]
  stripeCustomers         StripeCustomer[]
  subscription            Subscription?
  merchants               Merchant[]
  menuCategoryItems       MenuCategoryItem[]
  menuItemTaxes           MenuItemTax[]
  websiteGenerations      WebsiteGeneration[]
  integrationConnections  IntegrationConnection[]
  externalIdMappings      ExternalIdMapping[]
  integrationSyncRecords  IntegrationSyncRecord[]
  webhookEvents           WebhookEvent[]

  @@index([slug])
  @@map("tenants")
}
```

- [ ] **Step 2: Delete the entire Company model**

Remove the `Company` model block (lines 58–99, the `model Company { ... }` block).

- [ ] **Step 3: Remove companyId from all child models**

For each of these models, remove the `companyId` field, the `company` relation, and all `@@index` entries that reference `companyId`. Update unique constraints that included `companyId` to use `tenantId` instead.

**Menu** — remove `companyId`, `company` relation, `@@index([companyId])`, `@@index([companyId, sortOrder])`.

**MenuCategory** — remove `companyId`, `company` relation, `@@index([companyId])`, `@@index([companyId, sortOrder])`.

**MenuItem** — remove `companyId`, `company` relation, `@@index([companyId])`, `@@index([companyId, status])`.

**Merchant** — remove `companyId`, `company` relation, `@@index([companyId])`.

**Order** — remove `companyId`, `company` relation, `@@index([companyId])`.

**User** — remove `companyId` (nullable), `company` relation, `@@index([companyId])`.

**TaxConfig** — remove `companyId`, `company` relation, `@@index([companyId])`, `@@index([companyId, status])`. Add `@@index([tenantId, status])`.

**LoyaltyConfig** — remove `companyId` (was `@unique`), `company` relation. Change to `tenantId @unique` (add `@unique` to existing tenantId field and remove the separate `@@index([tenantId])`).

**LoyaltyMember** — remove `companyId`, `company` relation, `@@index([companyId])`. Change `@@unique([tenantId, companyId, phone])` to `@@unique([tenantId, phone])`.

**FeaturedItem** — remove `companyId`, `company` relation, `@@index([companyId])`. Change `@@unique([companyId, menuItemId])` to `@@unique([tenantId, menuItemId])`.

**GiftCard** — remove `companyId`, `company` relation, `@@index([companyId])`.

**CompanyOrderSequence** — remove `companyId`, `company` relation, `@@index([companyId])`. Change `@@unique([tenantId, companyId, date])` to `@@unique([tenantId, date])`.

**StripeCustomer** — remove `companyId`, `company` relation, `@@index([companyId])`.

- [ ] **Step 4: Run Prisma generate to verify schema is valid**

Run: `npx prisma generate`
Expected: Success, no errors.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "refactor: merge Company model into Tenant in Prisma schema

Remove Company model entirely. Move all Company fields (slug, description,
logoUrl, currency, locale, timezone, onboarding, settings, etc.) into Tenant.
Remove companyId from all 14 child models."
```

---

### Task 2: Create Tenant Types

**Files:**
- Create: `src/types/tenant.ts`
- Modify: `src/types/merchant.ts`
- Modify: `src/types/next-auth.d.ts`

- [ ] **Step 1: Create src/types/tenant.ts**

This replaces `src/types/company.ts` with tenant-based naming:

```typescript
import type { ThemePresetName } from "./theme";
import type { OnboardingStatus, OnboardingData } from "./onboarding";

// ==================== Tenant Types ====================

export type TenantStatus = "active" | "inactive" | "suspended";

export interface TenantInfo {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  websiteUrl: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  currency: string;
  locale: string;
  timezone: string;
  status: TenantStatus;
  subscriptionPlan: string;
  subscriptionStatus: string;
  stripeConnectStatus: string | null;

  // Onboarding fields
  onboardingStatus: OnboardingStatus;
  onboardingData: OnboardingData | null;
  onboardingCompletedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export interface SocialLink {
  platform: "facebook" | "instagram" | "twitter" | "yelp" | "google";
  url: string;
}

export type FeaturedItemRef = string;

export interface CustomerReview {
  id: string;
  customerName: string;
  rating: number;
  content: string;
  date: string;
  source: "google" | "yelp" | "facebook" | "website";
  avatarUrl?: string;
}

export interface GiftcardConfig {
  enabled: boolean;
  denominations: number[];
  imageUrl?: string;
  description?: string;
}

export interface TenantSettings {
  defaultCurrency?: string;
  defaultLocale?: string;
  defaultTimezone?: string;
  themePreset?: ThemePresetName;

  website?: {
    tagline?: string;
    heroImage?: string;
    socialLinks?: SocialLink[];
    featuredItemIds?: FeaturedItemRef[];
    reviews?: CustomerReview[];
  };

  giftcard?: GiftcardConfig;
}

export interface MerchantSummary {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  state: string | null;
  status: string;
}

export interface TenantWithMerchants extends TenantInfo {
  merchants: MerchantSummary[];
}

// ==================== Tenant Input Types ====================

export interface CreateTenantInput {
  slug: string;
  name: string;
  description?: string;
  logoUrl?: string;
  websiteUrl?: string;
  supportEmail?: string;
  supportPhone?: string;
  currency?: string;
  locale?: string;
  timezone?: string;
  settings?: TenantSettings;
}

export interface UpdateTenantInput {
  name?: string;
  description?: string;
  logoUrl?: string;
  websiteUrl?: string;
  supportEmail?: string;
  supportPhone?: string;
  currency?: string;
  locale?: string;
  timezone?: string;
  settings?: TenantSettings;
  status?: TenantStatus;
}
```

- [ ] **Step 2: Update src/types/merchant.ts**

Remove `companyId` from `MerchantInfo` and `MerchantContext`:

```typescript
// In MerchantInfo interface — remove line: companyId: string;

// In MerchantContext interface — change to:
export interface MerchantContext {
  merchantId: string;
  merchantSlug: string;
  tenantId: string;
}
```

- [ ] **Step 3: Remove companyId from NextAuth types**

In `src/types/next-auth.d.ts`, remove `companyId: string | null;` from both `User` and `JWT` interfaces.

The file becomes:

```typescript
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    id: string;
    email: string;
    name: string;
    role: string;
    tenantId: string;
  }

  interface Session {
    user: User;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    tenantId: string;
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/types/tenant.ts src/types/merchant.ts src/types/next-auth.d.ts
git commit -m "refactor: add TenantInfo types, remove companyId from merchant and auth types"
```

---

### Task 3: Create Tenant Repository & Service

**Files:**
- Create: `src/repositories/tenant.repository.ts`
- Create: `src/services/tenant/tenant.service.ts`
- Create: `src/services/tenant/tenant.types.ts`
- Create: `src/services/tenant/index.ts`

- [ ] **Step 1: Create src/repositories/tenant.repository.ts**

```typescript
import prisma from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { generateEntityId } from "@/lib/id";

export class TenantRepository {
  async getById(tenantId: string) {
    return prisma.tenant.findUnique({
      where: { id: tenantId, deleted: false },
    });
  }

  async getBySlug(slug: string) {
    return prisma.tenant.findUnique({
      where: { slug, deleted: false },
    });
  }

  async getBySlugWithMerchants(slug: string) {
    return prisma.tenant.findUnique({
      where: { slug, deleted: false },
      include: {
        merchants: {
          where: { status: "active", deleted: false },
          orderBy: { name: "asc" },
        },
      },
    });
  }

  async getWithMerchants(tenantId: string) {
    return prisma.tenant.findUnique({
      where: { id: tenantId, deleted: false },
      include: {
        merchants: {
          where: { deleted: false },
          orderBy: { name: "asc" },
        },
      },
    });
  }

  async create(data: Omit<Prisma.TenantCreateInput, "id">) {
    return prisma.tenant.create({
      data: {
        id: generateEntityId(),
        ...data,
      },
    });
  }

  async update(tenantId: string, data: Prisma.TenantUpdateInput) {
    return prisma.tenant.update({
      where: { id: tenantId },
      data,
    });
  }

  async delete(tenantId: string) {
    return prisma.tenant.update({
      where: { id: tenantId },
      data: { deleted: true, updatedAt: new Date() },
    });
  }
}

export const tenantRepository = new TenantRepository();
```

- [ ] **Step 2: Create src/services/tenant/tenant.types.ts**

```typescript
export type {
  TenantInfo,
  TenantStatus,
  TenantSettings,
  TenantWithMerchants,
  MerchantSummary,
  CreateTenantInput,
  UpdateTenantInput,
} from "@/types/tenant";

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
```

- [ ] **Step 3: Create src/services/tenant/tenant.service.ts**

```typescript
import { tenantRepository } from "@/repositories/tenant.repository";
import { merchantRepository } from "@/repositories/merchant.repository";
import prisma from "@/lib/db";
import { AppError, ErrorCodes } from "@/lib/errors";
import type { Prisma } from "@prisma/client";
import type {
  CreateTenantInput,
  UpdateTenantInput,
} from "./tenant.types";
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

export class TenantService {
  async createTenant(input: CreateTenantInput) {
    return tenantRepository.create({
      name: input.name,
      slug: input.slug,
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

  async getTenant(tenantId: string) {
    return tenantRepository.getById(tenantId);
  }

  async getTenantBySlug(slug: string) {
    return tenantRepository.getBySlug(slug);
  }

  async getTenantWithMerchants(tenantId: string) {
    return tenantRepository.getWithMerchants(tenantId);
  }

  async updateTenant(tenantId: string, input: UpdateTenantInput) {
    const data: Prisma.TenantUpdateInput = {};

    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.logoUrl !== undefined) data.logoUrl = input.logoUrl;
    if (input.websiteUrl !== undefined) data.websiteUrl = input.websiteUrl;
    if (input.supportEmail !== undefined) data.supportEmail = input.supportEmail;
    if (input.supportPhone !== undefined) data.supportPhone = input.supportPhone;
    if (input.currency !== undefined) data.currency = input.currency;
    if (input.locale !== undefined) data.locale = input.locale;
    if (input.timezone !== undefined) data.timezone = input.timezone;
    if (input.settings !== undefined)
      data.settings = input.settings as Prisma.InputJsonValue;
    if (input.status !== undefined) data.status = input.status;

    return tenantRepository.update(tenantId, data);
  }

  async deleteTenant(tenantId: string) {
    return tenantRepository.delete(tenantId);
  }

  async createMerchant(tenantId: string, input: CreateMerchantInput) {
    const tenant = await tenantRepository.getById(tenantId);
    if (!tenant) {
      throw new AppError(ErrorCodes.COMPANY_NOT_FOUND, undefined, 404);
    }

    const isAvailable = await merchantRepository.isSlugAvailable(input.slug);
    if (!isAvailable) {
      throw new AppError(ErrorCodes.MERCHANT_SLUG_TAKEN, { slug: input.slug }, 409);
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

  async getMerchants(tenantId: string) {
    return merchantRepository.getByTenantId(tenantId);
  }

  async getActiveMerchants(tenantId: string) {
    return merchantRepository.getActiveByTenantId(tenantId);
  }

  // ==================== Onboarding Methods ====================

  async initializeOnboarding(tenantId: string) {
    const tenant = await tenantRepository.getById(tenantId);
    if (!tenant) {
      throw new AppError(ErrorCodes.COMPANY_NOT_FOUND, undefined, 404);
    }

    if (tenant.onboardingStatus !== "not_started") {
      return tenant;
    }

    const isClaimed = tenant.source === "generator";

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

    return tenantRepository.update(tenantId, {
      onboardingStatus: "in_progress",
      onboardingData: data as unknown as Prisma.InputJsonValue,
    });
  }

  async updateOnboardingStep(
    tenantId: string,
    stepId: OnboardingStepId,
    status: OnboardingStepStatus
  ) {
    const tenant = await tenantRepository.getById(tenantId);
    if (!tenant) {
      throw new AppError(ErrorCodes.COMPANY_NOT_FOUND, undefined, 404);
    }

    const currentData =
      (tenant.onboardingData as unknown as OnboardingData) ??
      DEFAULT_ONBOARDING_DATA;

    const updatedSteps = { ...currentData.steps };
    updatedSteps[stepId] = {
      status,
      ...(status === "completed" || status === "skipped"
        ? { completedAt: new Date().toISOString() }
        : {}),
    };

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

    const allFinished = isOnboardingComplete(updatedData);

    return tenantRepository.update(tenantId, {
      onboardingStatus: allFinished ? "completed" : "in_progress",
      onboardingData: updatedData as unknown as Prisma.InputJsonValue,
      ...(allFinished ? { onboardingCompletedAt: new Date() } : {}),
    });
  }

  async getOnboardingStatus(tenantId: string) {
    const tenant = await tenantRepository.getById(tenantId);
    if (!tenant) {
      throw new AppError(ErrorCodes.COMPANY_NOT_FOUND, undefined, 404);
    }

    return {
      status: tenant.onboardingStatus,
      data: tenant.onboardingData as unknown as OnboardingData | null,
      completedAt: tenant.onboardingCompletedAt,
    };
  }

  async dismissOnboarding(tenantId: string) {
    const tenant = await tenantRepository.getById(tenantId);
    if (!tenant) {
      throw new AppError(ErrorCodes.COMPANY_NOT_FOUND, undefined, 404);
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
}

export const tenantService = new TenantService();
```

- [ ] **Step 4: Create src/services/tenant/index.ts**

```typescript
export * from "./tenant.service";
export * from "./tenant.types";
```

- [ ] **Step 5: Commit**

```bash
git add src/repositories/tenant.repository.ts src/services/tenant/
git commit -m "feat: add TenantRepository and TenantService to replace Company equivalents"
```

---

### Task 4: Update Merchant Repository & Mapper

**Files:**
- Modify: `src/repositories/merchant.repository.ts`
- Modify: `src/services/merchant/merchant.mapper.ts`
- Modify: `src/services/merchant/merchant.types.ts`

- [ ] **Step 1: Update merchant.repository.ts**

Replace all `companyId`-based queries with `tenantId`. The `company` relation no longer exists — Merchant now belongs directly to Tenant.

Key changes:
- `getBySlugWithCompany()` → include `tenant` instead of `company: { include: { tenant: true } }`
- `getByCompanyId(companyId)` → `getByTenantId(tenantId)` with `where: { tenantId }`
- `getActiveByCompanyId(companyId)` → `getActiveByTenantId(tenantId)` with `where: { tenantId }`
- `getByIdWithCompany(merchantId)` → `getByIdWithTenant(merchantId)` include `tenant`
- `getByCompanyIdWithCompany(companyId)` → `getByTenantIdWithTenant(tenantId)` include `tenant`
- `getActiveByCompanyIdWithCompany(companyId)` → `getActiveByTenantIdWithTenant(tenantId)` include `tenant`
- `create(companyId, tenantId, data)` → `create(tenantId, data)` — remove `company: { connect }`, keep `tenant: { connect }`
- `updateSettings()` — include `tenant` instead of `company: { include: { tenant } }`
- Remove the deprecated `getByTenantId` that queried through Company

The full updated file:

```typescript
import prisma from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { generateEntityId } from "@/lib/id";

export class MerchantRepository {
  async getById(merchantId: string) {
    return prisma.merchant.findUnique({
      where: { id: merchantId, deleted: false },
    });
  }

  async getBySlug(slug: string) {
    return prisma.merchant.findFirst({
      where: { slug, deleted: false },
    });
  }

  async getBySlugWithTenant(slug: string) {
    return prisma.merchant.findFirst({
      where: { slug, deleted: false },
      include: {
        tenant: true,
      },
    });
  }

  async getByTenantId(tenantId: string) {
    return prisma.merchant.findMany({
      where: { tenantId, deleted: false },
      orderBy: { name: "asc" },
    });
  }

  async getActiveByTenantId(tenantId: string) {
    return prisma.merchant.findMany({
      where: {
        tenantId,
        status: "active",
        deleted: false,
      },
      orderBy: { name: "asc" },
    });
  }

  async getByIdWithTenant(merchantId: string) {
    return prisma.merchant.findUnique({
      where: { id: merchantId, deleted: false },
      include: {
        tenant: true,
      },
    });
  }

  async getByTenantIdWithTenant(tenantId: string) {
    return prisma.merchant.findMany({
      where: { tenantId, deleted: false },
      orderBy: { name: "asc" },
      include: {
        tenant: true,
      },
    });
  }

  async getActiveByTenantIdWithTenant(tenantId: string) {
    return prisma.merchant.findMany({
      where: {
        tenantId,
        status: "active",
        deleted: false,
      },
      orderBy: { name: "asc" },
      include: {
        tenant: true,
      },
    });
  }

  async create(
    tenantId: string,
    data: Omit<Prisma.MerchantCreateInput, "id" | "tenant">
  ) {
    return prisma.merchant.create({
      data: {
        id: generateEntityId(),
        ...data,
        tenant: { connect: { id: tenantId } },
      },
    });
  }

  async update(merchantId: string, data: Prisma.MerchantUpdateInput) {
    return prisma.merchant.update({
      where: { id: merchantId },
      data,
    });
  }

  async updateSettings(merchantId: string, settings: Record<string, unknown>) {
    return prisma.merchant.update({
      where: { id: merchantId },
      data: { settings: settings as Prisma.InputJsonValue },
      include: {
        tenant: true,
      },
    });
  }

  async isSlugAvailable(slug: string, excludeMerchantId?: string) {
    const existing = await prisma.merchant.findFirst({
      where: { slug, deleted: false },
      select: { id: true },
    });

    if (!existing) return true;
    if (excludeMerchantId && existing.id === excludeMerchantId) return true;
    return false;
  }

  async isOpen(merchantId: string): Promise<boolean> {
    const merchant = await this.getById(merchantId);
    if (!merchant?.businessHours) return false;

    const hours = merchant.businessHours as Record<
      string,
      { open: string; close: string; closed?: boolean }
    >;

    const now = new Date();
    const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const currentDay = dayNames[now.getDay()];
    const todayHours = hours[currentDay];

    if (!todayHours || todayHours.closed) return false;

    const currentTime = now.toTimeString().slice(0, 5);
    return currentTime >= todayHours.open && currentTime <= todayHours.close;
  }

  async delete(merchantId: string) {
    return prisma.merchant.update({
      where: { id: merchantId },
      data: { deleted: true, updatedAt: new Date() },
    });
  }
}

export const merchantRepository = new MerchantRepository();
```

- [ ] **Step 2: Update merchant.mapper.ts**

Now Merchant includes Tenant directly (no nested Company). The mapper needs to flatten the structure:

```typescript
import type { Prisma } from "@prisma/client";
import type { TenantSettings } from "@/types/tenant";
import type { MerchantSettings, MerchantStatus, BusinessHoursMap } from "@/types/merchant";
import type { MerchantWithCompany, CompanyWithMerchants } from "./merchant.types";

// Prisma return types — Merchant with Tenant
type MerchantWithTenant = Prisma.MerchantGetPayload<{
  include: {
    tenant: true;
  };
}>;

// Prisma return types — Tenant with Merchants
type TenantWithMerchants = Prisma.TenantGetPayload<{
  include: {
    merchants: true;
  };
}>;

type MerchantFromTenantQuery = Prisma.MerchantGetPayload<object>;

/**
 * Map Prisma Merchant (with Tenant) → Service MerchantWithCompany type
 * Note: We keep the "company" field name in the service type for now
 * to minimize downstream changes. The "company" data comes from Tenant.
 */
export function toMerchantWithCompany(
  data: MerchantWithTenant
): MerchantWithCompany {
  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    tenantId: data.tenantId,
    description: data.description ?? undefined,
    address: data.address ?? undefined,
    city: data.city ?? undefined,
    state: data.state ?? undefined,
    zipCode: data.zipCode ?? undefined,
    country: data.country,
    phone: data.phone ?? undefined,
    email: data.email ?? undefined,
    logoUrl: data.logoUrl ?? undefined,
    bannerUrl: data.bannerUrl ?? undefined,
    businessHours: data.businessHours as BusinessHoursMap | undefined,
    timezone: data.timezone,
    currency: data.currency,
    locale: data.locale,
    status: data.status as MerchantStatus,
    settings: (data.settings as unknown) as MerchantSettings | undefined,
    company: {
      id: data.tenant.id,
      slug: data.tenant.slug,
      tenantId: data.tenant.id,
      name: data.tenant.name,
      logoUrl: data.tenant.logoUrl ?? undefined,
      settings: data.tenant.settings as TenantSettings | undefined,
      tenant: {
        id: data.tenant.id,
        name: data.tenant.name,
        subscriptionStatus: data.tenant.subscriptionStatus,
      },
    },
  };
}

/**
 * Map Prisma Tenant (with Merchants) → Service CompanyWithMerchants type
 */
export function toCompanyWithMerchants(
  data: TenantWithMerchants
): CompanyWithMerchants {
  return {
    id: data.id,
    slug: data.slug,
    tenantId: data.id,
    name: data.name,
    description: data.description ?? undefined,
    logoUrl: data.logoUrl ?? undefined,
    settings: data.settings as TenantSettings | undefined,
    tenant: {
      id: data.id,
      name: data.name,
      subscriptionStatus: data.subscriptionStatus,
    },
    merchants: data.merchants.map((m) => toMerchantFromTenant(m, data)),
  };
}

function toMerchantFromTenant(
  merchant: MerchantFromTenantQuery,
  tenant: TenantWithMerchants
): MerchantWithCompany {
  return {
    id: merchant.id,
    slug: merchant.slug,
    name: merchant.name,
    tenantId: merchant.tenantId,
    description: merchant.description ?? undefined,
    address: merchant.address ?? undefined,
    city: merchant.city ?? undefined,
    state: merchant.state ?? undefined,
    zipCode: merchant.zipCode ?? undefined,
    country: merchant.country,
    phone: merchant.phone ?? undefined,
    email: merchant.email ?? undefined,
    logoUrl: merchant.logoUrl ?? undefined,
    bannerUrl: merchant.bannerUrl ?? undefined,
    businessHours: merchant.businessHours as BusinessHoursMap | undefined,
    timezone: merchant.timezone,
    currency: merchant.currency,
    locale: merchant.locale,
    status: merchant.status as MerchantStatus,
    settings: (merchant.settings as unknown) as MerchantSettings | undefined,
    company: {
      id: tenant.id,
      slug: tenant.slug,
      tenantId: tenant.id,
      name: tenant.name,
      logoUrl: tenant.logoUrl ?? undefined,
      settings: tenant.settings as TenantSettings | undefined,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        subscriptionStatus: tenant.subscriptionStatus,
      },
    },
  };
}
```

- [ ] **Step 3: Update merchant.types.ts**

Replace `companyId` with `tenantId` in `MerchantWithCompany` and `MerchantBasic`. Update imports from `@/types/company` to `@/types/tenant`. Change `CompanySettings` to `TenantSettings` throughout.

Key changes:
- Line 4: `import type { TenantSettings } from "@/types/tenant";`
- Line 20: `companyId: string;` → `tenantId: string;`
- Line 44: `settings?: CompanySettings;` → `settings?: TenantSettings;`
- Line 79: `companyId: string;` → `tenantId: string;`
- Line 178: `import type { SocialLink, CustomerReview } from "@/types/tenant";`

- [ ] **Step 4: Commit**

```bash
git add src/repositories/merchant.repository.ts src/services/merchant/merchant.mapper.ts src/services/merchant/merchant.types.ts
git commit -m "refactor: update merchant repository and mapper to use Tenant directly"
```

---

### Task 5: Update Merchant Service

**Files:**
- Modify: `src/services/merchant/merchant.service.ts`

- [ ] **Step 1: Replace company imports and queries with tenant**

Key changes:
- Remove `import { companyRepository }` — replace with `import { tenantRepository }`
- Remove `import type { CompanySettings } from "@/types/company"` — replace with `import type { TenantSettings } from "@/types/tenant"`
- `getCompanyBySlug(slug)` → uses `tenantRepository.getBySlugWithMerchants(slug)` instead of `companyRepository.getBySlugWithMerchants(slug)`
- `getMerchantBySlug/getMerchantById` — `getBySlugWithCompany` → `getBySlugWithTenant`, `getByIdWithCompany` → `getByIdWithTenant`
- `getMerchantsByCompanyId(tenantId, companyId)` → `getMerchantsByTenantId(tenantId)` — remove companyId param, query by tenantId directly
- `createMerchant(tenantId, companyId, input)` → `createMerchant(tenantId, input)` — remove companyId param, validate tenant exists instead of company
- `getMerchant(tenantId, merchantId)` — check `data.tenantId !== tenantId` instead of `data.company.tenantId`
- `updateMerchant/updateSettings/deleteMerchant` — `getByIdWithCompany` → `getByIdWithTenant`
- `getCompanyWebsiteData` — uses `tenantRepository.getBySlugWithMerchants()`, cast settings to `TenantSettings`
- `getWebsiteData` — cast `merchant.company.settings` to `TenantSettings`

- [ ] **Step 2: Commit**

```bash
git add src/services/merchant/merchant.service.ts
git commit -m "refactor: update MerchantService to use tenant instead of company"
```

---

### Task 6: Update Auth Service & Auth Config

**Files:**
- Modify: `src/services/auth/auth.service.ts`
- Modify: `src/lib/auth.ts`

- [ ] **Step 1: Update auth.service.ts**

Remove Company creation from the `findOrCreateStytchUser` transaction. Instead, create Tenant with all fields directly:

```typescript
import prisma from "@/lib/db";
import { generateEntityId } from "@/lib/id";
import { slugify } from "@/services/generator/slug.util";
import type { User } from "@prisma/client";

export class AuthService {
  async findOrCreateStytchUser(
    email: string,
    stytchUserId: string
  ): Promise<{ user: User; isNewUser: boolean }> {
    const existingByStytch = await prisma.user.findUnique({
      where: { stytchUserId },
    });
    if (existingByStytch) {
      await prisma.user.update({
        where: { id: existingByStytch.id },
        data: { lastLoginAt: new Date() },
      });
      return { user: existingByStytch, isNewUser: false };
    }

    const existingByEmail = await prisma.user.findFirst({
      where: { email, deleted: false },
    });
    if (existingByEmail) {
      const updated = await prisma.user.update({
        where: { id: existingByEmail.id },
        data: { stytchUserId, lastLoginAt: new Date() },
      });
      return { user: updated, isNewUser: false };
    }

    const emailPrefix = email.split("@")[0];
    const companyName = `${emailPrefix}'s Company`;
    const baseSlug = slugify(companyName);

    const existingTenant = await prisma.tenant.findUnique({
      where: { slug: baseSlug },
    });
    const slug = existingTenant
      ? `${baseSlug}-${Date.now()}`
      : baseSlug;

    const tenantId = generateEntityId();
    const userId = generateEntityId();

    const user = await prisma.$transaction(async (tx) => {
      await tx.tenant.create({
        data: {
          id: tenantId,
          name: companyName,
          slug,
        },
      });

      return tx.user.create({
        data: {
          id: userId,
          tenantId,
          email,
          stytchUserId,
          name: emailPrefix,
          role: "owner",
          status: "active",
          lastLoginAt: new Date(),
        },
      });
    });

    return { user, isNewUser: true };
  }
}

export const authService = new AuthService();
```

- [ ] **Step 2: Update src/lib/auth.ts**

Remove all `companyId` references:
- Line 40: Remove `companyId: user.companyId,`
- Line 55: Remove `token.companyId = user.companyId;`
- Line 65: Remove `session.user.companyId = token.companyId as string | null;`

- [ ] **Step 3: Commit**

```bash
git add src/services/auth/auth.service.ts src/lib/auth.ts
git commit -m "refactor: remove companyId from auth flow, create Tenant directly"
```

---

### Task 7: Update Remaining Repositories

**Files:**
- Modify: `src/repositories/menu.repository.ts`
- Modify: `src/repositories/menu-entity.repository.ts`
- Modify: `src/repositories/order.repository.ts`
- Modify: `src/repositories/loyalty-member.repository.ts`
- Modify: `src/repositories/loyalty-config.repository.ts`
- Modify: `src/repositories/featured-item.repository.ts`
- Modify: `src/repositories/giftcard.repository.ts`
- Modify: `src/repositories/tax-config.repository.ts`
- Modify: `src/repositories/sequence.repository.ts`
- Modify: `src/repositories/point-transaction.repository.ts`
- Modify: `src/repositories/catering-order.repository.ts`

- [ ] **Step 1: Update each repository**

For every repository file:
1. Replace `companyId` parameters with `tenantId` where `companyId` was used as the scope key
2. Remove `companyId` from `where` clauses — use `tenantId` instead
3. Remove `company: { connect: { id: companyId } }` from create operations
4. Replace any `include: { company: ... }` with `include: { tenant: ... }`
5. Update unique constraint references (e.g., `companyId_menuItemId` → `tenantId_menuItemId`)

Specific patterns per repository:

**menu.repository.ts & menu-entity.repository.ts:**
- `getMenusByCompany(tenantId, companyId)` → `getMenusByTenant(tenantId)` — use `where: { tenantId }`
- `createCategory/createItem` — remove `companyId` from data, remove `company: { connect }`

**order.repository.ts:**
- Remove `company: { connect: { id: companyId } }` from create
- `getCompanyOrders(tenantId, companyId)` → `getTenantOrders(tenantId)` — use `where: { tenantId }`

**loyalty-config.repository.ts:**
- `getByCompanyId(tenantId, companyId)` → `getByTenantId(tenantId)` — use `where: { tenantId }` (unique now)
- `create` — remove `companyId` from data

**loyalty-member.repository.ts:**
- `getByPhone(tenantId, companyId, phone)` → `getByPhone(tenantId, phone)` — remove `companyId` from where
- `create` — remove `companyId` from data
- `countByCompany(tenantId, companyId)` → `countByTenant(tenantId)`

**featured-item.repository.ts:**
- `getByCompanyId(tenantId, companyId)` → `getByTenantId(tenantId)` — use `where: { tenantId }`
- `setFeaturedItems/addFeaturedItem/removeFeaturedItem/reorderFeaturedItems` — replace `companyId` with `tenantId`

**giftcard.repository.ts:**
- `create(tenantId, companyId, ...)` → `create(tenantId, ...)` — remove `company: { connect }`
- `getByCardNumber(tenantId, companyId, cardNumber)` → `getByCardNumber(tenantId, cardNumber)` — remove `companyId` from where
- `getByCompany/getStatsByCompany` → `getByTenant/getStatsByTenant`

**tax-config.repository.ts:**
- `getTaxConfigsByCompany(tenantId, companyId)` → `getTaxConfigsByTenant(tenantId)`
- `createTaxConfig` — remove `company: { connect }` from data

**sequence.repository.ts:**
- `getNextCompanyOrderSequence(tenantId, companyId, date)` → `getNextCompanyOrderSequence(tenantId, date)` — remove `companyId` from where/create

**point-transaction.repository.ts:**
- `create` — remove `companyId` from data if present

**catering-order.repository.ts:**
- Remove `companyId` from create data if present

- [ ] **Step 2: Commit**

```bash
git add src/repositories/
git commit -m "refactor: remove companyId from all repositories, use tenantId exclusively"
```

---

### Task 8: Update Remaining Services

**Files:**
- Modify: `src/services/menu/menu.service.ts`
- Modify: `src/services/menu/tax-config.service.ts`
- Modify: `src/services/loyalty/loyalty.service.ts`
- Modify: `src/services/loyalty/loyalty-config.service.ts`
- Modify: `src/services/loyalty/loyalty-member.service.ts`
- Modify: `src/services/loyalty/loyalty.types.ts`
- Modify: `src/services/giftcard/giftcard.service.ts`
- Modify: `src/services/order/order.service.ts`
- Modify: `src/services/order/order.types.ts`
- Modify: `src/services/payment/payment.service.ts`
- Modify: `src/services/payment/payment.types.ts`
- Modify: `src/services/catering/catering.service.ts`
- Modify: `src/services/catering/catering-order.service.ts`
- Modify: `src/services/generator/generator.service.ts`
- Modify: `src/services/generator/generator.types.ts`
- Modify: `src/services/square/square.service.ts`
- Modify: `src/services/dashboard-agent/dashboard-agent.service.ts`
- Modify: `src/services/dashboard-agent/dashboard-agent.types.ts`

- [ ] **Step 1: Update each service**

For every service file, apply these patterns:

1. **Remove `companyId` parameter** from all methods that received both `tenantId` and `companyId`. Since Tenant IS Company now, `tenantId` is sufficient.

2. **Update repository calls** to match the new repository method signatures from Task 7.

3. **Remove `company` imports** — replace `import { companyRepository }` or `import type { CompanySettings }` with tenant equivalents.

4. **Update type references** — `CompanySettings` → `TenantSettings`, `CompanyInfo` → `TenantInfo`.

Service-specific changes:

**menu.service.ts:**
- `getMenus(tenantId, companyId)` → `getMenus(tenantId)` — call `menuEntityRepository.getMenusByTenant(tenantId)`
- `createMenu(tenantId, companyId, input)` → `createMenu(tenantId, input)`
- `getMenuItemsByCompanyId(tenantId, companyId, itemIds)` → `getMenuItemsByTenantId(tenantId, itemIds)`
- `getFeaturedItems(tenantId, companyId)` → `getFeaturedItems(tenantId)` — call `featuredItemRepository.getByTenantId(tenantId)`
- Where `merchant.companyId` was used, use `merchant.tenantId`

**tax-config.service.ts:**
- `getTaxConfigs(tenantId, companyId)` → `getTaxConfigs(tenantId)`
- `createTaxConfig(tenantId, companyId, input)` → `createTaxConfig(tenantId, input)`
- `updateTaxConfig(tenantId, companyId, id, input)` → `updateTaxConfig(tenantId, id, input)`

**loyalty.service.ts:**
- `processOrderCompletion(tenantId, companyId, orderId, data)` → `processOrderCompletion(tenantId, orderId, data)`
- Remove `companyId` from all internal calls to config/member services

**loyalty-config.service.ts:**
- `isLoyaltyEnabled(tenantId, companyId)` → `isLoyaltyEnabled(tenantId)`
- `getConfig(tenantId, companyId)` → `getConfig(tenantId)`
- `getPointsPerDollar(tenantId, companyId)` → `getPointsPerDollar(tenantId)`

**loyalty-member.service.ts:**
- `getMemberByPhone(tenantId, companyId, phone)` → `getMemberByPhone(tenantId, phone)`
- `getOrCreateMember(tenantId, companyId, phone)` → `getOrCreateMember(tenantId, phone)`
- `getMembersByCompany(tenantId, companyId, options)` → `getMembersByTenant(tenantId, options)`

**loyalty.types.ts:**
- Remove `companyId` from LoyaltyConfig and LoyaltyMember interfaces

**giftcard.service.ts:**
- `createGiftCard(tenantId, companyId, input)` → `createGiftCard(tenantId, input)`
- `validateGiftCard(tenantId, companyId, cardNumber)` → `validateGiftCard(tenantId, cardNumber)`
- `getCompanyGiftCards(tenantId, companyId, options)` → `getTenantGiftCards(tenantId, options)`

**order.service.ts:**
- Remove `companyId` from `CreateMerchantOrderInput` and `CreateCompanyOrderInput`
- `createCompanyOrder` — remove `companyId` from data
- `getCompanyOrders(tenantId, companyId)` → `getTenantOrders(tenantId)`
- Update sequence calls to remove `companyId`

**order.types.ts:**
- Remove `companyId: string;` from `BaseOrderInput`

**payment.service.ts / payment.types.ts:**
- Remove `companyId` from `CreatePaymentIntentRequest`
- Remove `companyId` from Stripe metadata

**catering.service.ts / catering-order.service.ts:**
- `getLeadsByCompany(tenantId, companyId)` → `getLeadsByTenant(tenantId)`
- `getCompanyOrders(tenantId, companyId)` → `getTenantOrders(tenantId)`

**generator.service.ts / generator.types.ts:**
- Remove separate Company creation — create Tenant with all fields
- Remove `companyId` from `GeneratorResult`

**square.service.ts:**
- `syncCatalog(tenantId, merchantId, companyId)` → `syncCatalog(tenantId, merchantId)`
- Menu/item creation — remove `companyId` from data

**dashboard-agent.service.ts / dashboard-agent.types.ts:**
- Remove `companyId` from `ToolExecutionContext`
- `processMessageStream(... companyId ...)` → remove `companyId` param

- [ ] **Step 2: Commit**

```bash
git add src/services/
git commit -m "refactor: remove companyId from all service method signatures"
```

---

### Task 9: Delete Company Files

**Files:**
- Delete: `src/services/company/company.service.ts`
- Delete: `src/services/company/company.types.ts`
- Delete: `src/services/company/index.ts`
- Delete: `src/repositories/company.repository.ts`
- Delete: `src/types/company.ts`

- [ ] **Step 1: Delete all Company-specific files**

```bash
rm -rf src/services/company/
rm src/repositories/company.repository.ts
rm src/types/company.ts
```

- [ ] **Step 2: Fix remaining imports**

Search the entire codebase for any remaining imports from deleted files:

```bash
grep -r "@/services/company" src/ --include="*.ts" --include="*.tsx"
grep -r "@/repositories/company" src/ --include="*.ts" --include="*.tsx"
grep -r "@/types/company" src/ --include="*.ts" --include="*.tsx"
```

Update each found import to use `@/services/tenant` or `@/types/tenant` instead. Key type renames:
- `CompanyInfo` → `TenantInfo`
- `CompanySettings` → `TenantSettings`
- `CompanyStatus` → `TenantStatus`
- `CompanyWithMerchants` → keep as-is in merchant.types.ts (it's already a service-layer type that maps from Tenant data)
- `CreateCompanyInput` → `CreateTenantInput`
- `UpdateCompanyInput` → `UpdateTenantInput`
- `companyService` → `tenantService`
- `companyRepository` → `tenantRepository`

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor: delete Company service, repository, and types"
```

---

### Task 10: Update API Routes

**Files:**
- Modify: `src/app/api/dashboard/onboarding/route.ts`
- Modify: `src/app/api/dashboard/[merchantId]/agent/stream/route.ts`
- Modify: `src/app/api/storefront/[companySlug]/giftcard/route.ts`
- Modify: `src/app/api/storefront/[companySlug]/giftcard/validate/route.ts`
- Modify: `src/app/api/storefront/[companySlug]/payment-intent/route.ts`
- Modify: `src/app/api/storefront/loyalty/status/route.ts`
- Modify: `src/app/api/storefront/loyalty/me/route.ts`
- Modify: `src/app/api/storefront/loyalty/history/route.ts`
- Modify: `src/app/api/storefront/loyalty/otp/send/route.ts`
- Modify: `src/app/api/storefront/loyalty/otp/verify/route.ts`
- Modify: `src/app/api/storefront/loyalty/logout/route.ts`
- Modify: `src/app/api/storefront/loyalty/award-order-points/route.ts`
- Modify: `src/app/api/storefront/loyalty/order-points-status/route.ts`
- Modify: `src/app/api/storefront/r/[slug]/orders/route.ts`
- Modify: `src/app/api/storefront/r/[slug]/payment-intent/route.ts`
- Modify: `src/app/api/auth/claim/route.ts`
- Modify: `src/app/api/auth/stytch/callback/route.ts`
- Modify: All other `src/app/api/dashboard/[merchantId]/` routes that use companyId

- [ ] **Step 1: Update dashboard onboarding route**

Replace `companyService` with `tenantService`. Remove `session.user.companyId` — use only `session.user.tenantId`:

```typescript
import { tenantService } from "@/services/tenant/tenant.service";

// GET handler — change:
// session.user.companyId check → removed
// companyService.getOnboardingStatus(tenantId, companyId) → tenantService.getOnboardingStatus(tenantId)

// POST handler — change:
// companyService.updateOnboardingStep(tenantId, companyId, ...) → tenantService.updateOnboardingStep(tenantId, ...)
```

- [ ] **Step 2: Update storefront [companySlug] routes**

For gift card, payment-intent routes under `[companySlug]`:
- Replace `merchantService.getCompanyBySlug()` → `tenantRepository.getBySlugWithMerchants()` or `tenantService.getTenantBySlug()`
- Where `company.id` was used as `companyId`, use `tenant.id` as `tenantId`
- Remove `companyId` from service call parameters

- [ ] **Step 3: Update loyalty API routes**

For all routes under `src/app/api/storefront/loyalty/`:
- Where `companyId` was extracted from query params or request body, replace with `tenantId`
- Update service calls to remove `companyId` parameter

- [ ] **Step 4: Update remaining dashboard API routes**

Search all files under `src/app/api/dashboard/` for `companyId` references and update:
- Remove `session.user.companyId` — use `session.user.tenantId`
- Remove `companyId` from service call parameters

- [ ] **Step 5: Update auth routes**

In `src/app/api/auth/claim/route.ts` and `src/app/api/auth/stytch/callback/route.ts`:
- Remove any `companyId` handling

- [ ] **Step 6: Commit**

```bash
git add src/app/api/
git commit -m "refactor: remove companyId from all API routes"
```

---

### Task 11: Update Contexts & Dashboard UI

**Files:**
- Modify: `src/contexts/MerchantContext.tsx`
- Modify: `src/contexts/LoyaltyContext.tsx`
- Modify: `src/app/(storefront)/[companySlug]/layout.tsx`
- Modify: `src/app/(storefront)/[companySlug]/page.tsx`
- Modify: `src/app/(storefront)/r/[merchantSlug]/layout.tsx`
- Modify: `src/app/(dashboard)/dashboard/(protected)/company/page.tsx`
- Modify: `src/app/(dashboard)/dashboard/(protected)/company/actions.ts`
- Modify: `src/app/(dashboard)/dashboard/(protected)/page.tsx`
- Modify: `src/components/dashboard/company/CompanyInfoCard.tsx`
- Modify: `src/components/dashboard/company/CompanySettingsForm.tsx`
- Modify: Other dashboard/storefront components referencing companyId

- [ ] **Step 1: Update MerchantContext.tsx**

Remove `companyId` from `MerchantConfig` and `MerchantProviderProps`. Keep `companySlug` (it's still the URL param name). Remove `useCompanyId()` hook.

```typescript
// Remove from MerchantConfig interface:
//   companyId: string | null;

// Remove from MerchantProviderProps config:
//   companyId?: string | null;

// Remove from fullConfig:
//   companyId: config.companyId ?? null,

// Remove from useMemo deps:
//   config.companyId

// Delete the useCompanyId function entirely
```

- [ ] **Step 2: Update LoyaltyContext.tsx**

Replace `companyId` with `tenantId` in all API calls:
- Where `useCompanyId()` was called, use `useMerchantConfig().tenantId` instead
- Update API query params: `companyId=${companyId}` → `tenantId=${tenantId}`

- [ ] **Step 3: Update storefront layouts**

In `[companySlug]/layout.tsx` and `r/[merchantSlug]/layout.tsx`:
- Where `company.id` was passed as `companyId` to `MerchantProvider`, remove it
- Where `merchant.company.tenantId` was used, use `merchant.tenantId` directly

- [ ] **Step 4: Update dashboard company pages**

In `dashboard/(protected)/company/page.tsx` and `actions.ts`:
- Replace `companyService` with `tenantService`
- Replace `session.user.companyId` with `session.user.tenantId`
- Update `CompanyInfoCard` and `CompanySettingsForm` to receive tenant data

- [ ] **Step 5: Update dashboard home page**

In `dashboard/(protected)/page.tsx`:
- Remove `session.user.companyId` references
- Use `session.user.tenantId` for onboarding and data fetching

- [ ] **Step 6: Search and fix remaining companyId references in components**

```bash
grep -r "companyId\|companyService\|companyRepository\|CompanyInfo\|CompanySettings\|@/types/company\|@/services/company" src/ --include="*.ts" --include="*.tsx" -l
```

Fix each file found.

- [ ] **Step 7: Commit**

```bash
git add src/contexts/ src/app/ src/components/
git commit -m "refactor: remove companyId from contexts, UI components, and layouts"
```

---

### Task 12: Update Seed File

**Files:**
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Remove Company creation from seed**

For each seeded dataset (Joe's Pizza, Bella's Bakery, Onboarding tenant):

1. Remove `prisma.company.upsert(...)` / `prisma.company.create(...)` calls
2. Move Company fields (slug, description, logoUrl, currency, etc.) into the `prisma.tenant.upsert(...)` / `prisma.tenant.create(...)` call
3. Replace all `companyId: company.id` with `tenantId: tenant.id` in child entity creation
4. For destructured patterns like `const { id, tenantId, companyId, ...updateData } = item;`, remove `companyId`
5. Update featured item unique constraints: `companyId_menuItemId` → `tenantId_menuItemId`

Example for Joe's Pizza:

```typescript
// Before:
const tenant = await prisma.tenant.upsert({
  where: { id: "tenant-joes-pizza" },
  update: {},
  create: { id: "tenant-joes-pizza", name: "Joe's Pizza" },
});
const company = await prisma.company.upsert({
  where: { id: "company-joes-pizza" },
  update: joesPizzaCompanyData,
  create: { id: "company-joes-pizza", tenantId: tenant.id, ...joesPizzaCompanyData },
});

// After:
const tenant = await prisma.tenant.upsert({
  where: { id: "tenant-joes-pizza" },
  update: joesPizzaTenantData,
  create: { id: "tenant-joes-pizza", ...joesPizzaTenantData },
});
// No company creation needed
// All child entities use tenantId: tenant.id instead of companyId: company.id
```

- [ ] **Step 2: Commit**

```bash
git add prisma/seed.ts
git commit -m "refactor: update seed file to create Tenants directly without Company"
```

---

### Task 13: Verify & Fix TypeScript Compilation

**Files:**
- All files in `src/`

- [ ] **Step 1: Run TypeScript compiler**

Run: `npx tsc --noEmit`
Expected: Either success or a list of remaining type errors.

- [ ] **Step 2: Fix any remaining type errors**

The compiler will catch:
- Missing imports (files still importing from deleted `@/types/company` or `@/services/company`)
- Type mismatches (methods with wrong parameter counts due to removed `companyId`)
- Property access errors (`data.companyId` or `data.company.xxx` on types that no longer have these)

Fix each error based on the patterns established in earlier tasks.

- [ ] **Step 3: Run linter**

Run: `npm run lint`
Expected: Pass or only pre-existing warnings.

- [ ] **Step 4: Commit any remaining fixes**

```bash
git add -A
git commit -m "fix: resolve remaining TypeScript errors from company-to-tenant migration"
```

---

### Task 14: Run Tests & Database Sync

- [ ] **Step 1: Generate Prisma client**

Run: `npx prisma generate`
Expected: Success.

- [ ] **Step 2: Push schema to database**

Run: `npx prisma db push`
Expected: Success (this will sync the schema changes to the database).

Note: This is destructive for dev databases — Company table will be dropped, companyId columns removed. Seed data will need to be re-seeded.

- [ ] **Step 3: Re-seed the database**

Run: `npm run db:seed`
Expected: Success with the updated seed file.

- [ ] **Step 4: Run tests**

Run: `npm run test:run`
Expected: All tests pass. Fix any test failures caused by the migration.

- [ ] **Step 5: Run dev server smoke test**

Run: `npm run dev`
Verify:
- Dashboard login works (no companyId in session)
- Dashboard pages load (company settings, menu, orders)
- Storefront brand page loads at `/{companySlug}`
- Storefront menu page loads at `/r/{merchantSlug}/menu`

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: verify build, tests, and database sync after tenant-company merge"
```
