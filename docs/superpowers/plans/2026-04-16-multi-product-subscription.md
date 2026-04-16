# Multi-Product Line Subscription Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the subscription system from 1:1 (Tenant→Subscription) to 1:N, allowing each tenant to independently subscribe to multiple product lines (platform, phone_ai).

**Architecture:** Add a `productLine` field to the Subscription table with a `@@unique([tenantId, productLine])` constraint. Refactor plans to be organized by product line. Remove denormalized subscription fields from Tenant. All existing subscription logic gains a `productLine` parameter; webhook handlers auto-detect product line via `stripeSubscriptionId` lookup.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma ORM (MySQL), Stripe, Vitest

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `prisma/schema.prisma` | Modify | Add `productLine` to Subscription, remove denorm fields from Tenant |
| `src/services/subscription/subscription.types.ts` | Modify | Add `ProductLine` type, update interfaces |
| `src/services/subscription/subscription.plans.ts` | Modify | Reorganize plans by productLine |
| `src/services/subscription/subscription.service.ts` | Modify | Add `productLine` param to all methods, remove denorm calls |
| `src/services/subscription/index.ts` | Modify | Re-export `ProductLine` |
| `src/repositories/subscription.repository.ts` | Modify | Queries use `(tenantId, productLine)`, add `getAllByTenantId` |
| `src/types/tenant.ts` | Modify | Remove `subscriptionPlan`/`subscriptionStatus` |
| `src/services/merchant/merchant.types.ts` | Modify | Remove `subscriptionStatus` from types |
| `src/services/merchant/merchant.mapper.ts` | Modify | Remove `subscriptionStatus` mapping |
| `src/services/tenant/tenant.service.ts` | Modify | Remove `subscriptionStatus` from createTenantWithMerchant |
| `src/services/generator/generator.service.ts` | Modify | Remove `subscriptionStatus: "trial"` |
| `src/app/api/auth/claim/route.ts` | Modify | Remove subscription status check/update |
| `src/app/(storefront)/r/[merchantSlug]/layout.tsx` | Modify | Remove `isTrial` check |
| `src/app/(storefront)/[companySlug]/layout.tsx` | Modify | Remove `isTrial` check |
| `src/app/api/dashboard/subscription/route.ts` | Modify | Return multi-productLine overview |
| `src/app/api/dashboard/subscription/[productLine]/checkout/route.ts` | Create | Checkout with productLine param |
| `src/app/api/dashboard/subscription/[productLine]/change-plan/route.ts` | Create | Change plan with productLine param |
| `src/app/api/dashboard/subscription/[productLine]/cancel/route.ts` | Create | Cancel with productLine param |
| `src/app/api/dashboard/subscription/[productLine]/resume/route.ts` | Create | Resume with productLine param |
| `src/components/dashboard/subscription/ProductLineSection.tsx` | Create | Single product line UI section |
| `src/components/dashboard/subscription/SubscriptionClient.tsx` | Modify | Render multiple ProductLineSection |
| `src/app/(dashboard)/dashboard/(protected)/subscription/page.tsx` | Modify | Fetch all subscriptions |
| `src/services/subscription/__tests__/subscription.plans.test.ts` | Modify | Test productLine-based plan lookups |
| `src/services/subscription/__tests__/subscription.service.test.ts` | Modify | Update all tests for productLine param |
| `src/repositories/__tests__/subscription.repository.test.ts` | Modify | Update tests for new signatures |

---

### Task 1: Update Prisma Schema and Generate Migration

**Files:**
- Modify: `prisma/schema.prisma:11-75` (Tenant model), `prisma/schema.prisma:974-1017` (Subscription model)

- [ ] **Step 1: Modify Subscription model in schema.prisma**

Add `productLine` field, change unique constraint, remove `stripeCustomerId` unique:

```prisma
model Subscription {
  id       String @id
  tenantId String @map("tenant_id")
  productLine String @default("platform") @map("product_line")

  // Stripe references
  stripeCustomerId     String  @map("stripe_customer_id")
  stripeSubscriptionId String? @unique @map("stripe_subscription_id")
  stripePriceId        String? @map("stripe_price_id")

  // Status: incomplete | trialing | active | past_due | canceled | unpaid | paused
  status String @default("incomplete")

  // Plan: free | starter | pro | enterprise (per product line)
  plan String @default("free")

  // Billing cycle
  currentPeriodStart DateTime? @map("current_period_start")
  currentPeriodEnd   DateTime? @map("current_period_end")

  // Trial
  trialStart DateTime? @map("trial_start")
  trialEnd   DateTime? @map("trial_end")

  // Cancellation
  cancelAtPeriodEnd Boolean   @default(false) @map("cancel_at_period_end")
  canceledAt        DateTime? @map("canceled_at")

  // Grace period for past_due
  gracePeriodEnd DateTime? @map("grace_period_end")

  // Timestamps
  deleted   Boolean  @default(false)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  // Relations
  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@unique([tenantId, productLine])
  @@index([status])
  @@map("subscriptions")
}
```

- [ ] **Step 2: Modify Tenant model in schema.prisma**

Remove the two denormalized fields and change the relation:

```prisma
// REMOVE these two lines from the Tenant model:
//   subscriptionPlan       String                  @default("free") @map("subscription_plan")
//   subscriptionStatus     String                  @default("active") @map("subscription_status")

// CHANGE this line:
//   subscription           Subscription?
// TO:
  subscriptions          Subscription[]
```

- [ ] **Step 3: Run Prisma migration**

Run: `cd /Users/allan/workspace/plovr/plovr-grow-issue-277 && npx prisma migrate dev --name add_product_line_to_subscription`

The user must run this command since it requires a database connection. If the database is not available, pause here and ask the user to execute the migration.

- [ ] **Step 4: Generate Prisma client**

Run: `npm run db:generate`
Expected: Prisma Client generated successfully.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add productLine to Subscription, remove Tenant denorm fields (#277)"
```

---

### Task 2: Update Types and Plan Definitions

**Files:**
- Modify: `src/services/subscription/subscription.types.ts`
- Modify: `src/services/subscription/subscription.plans.ts`
- Modify: `src/services/subscription/index.ts`

- [ ] **Step 1: Write failing tests for new plan structure**

Update `src/services/subscription/__tests__/subscription.plans.test.ts`. Replace the entire file content:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const originalEnv = process.env;

describe("subscription.plans", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("PRODUCT_LINES", () => {
    it("should include platform and phone_ai", async () => {
      const { PRODUCT_LINES } = await import("../subscription.plans");
      expect(PRODUCT_LINES).toContain("platform");
      expect(PRODUCT_LINES).toContain("phone_ai");
    });
  });

  describe("PLAN_DEFINITIONS", () => {
    it("should organize plans by product line", async () => {
      const { PLAN_DEFINITIONS } = await import("../subscription.plans");
      expect(PLAN_DEFINITIONS.platform).toBeDefined();
      expect(PLAN_DEFINITIONS.phone_ai).toBeDefined();
    });

    it("should define starter, pro, and enterprise for platform", async () => {
      const { PLAN_DEFINITIONS } = await import("../subscription.plans");
      expect(PLAN_DEFINITIONS.platform.starter).toBeDefined();
      expect(PLAN_DEFINITIONS.platform.pro).toBeDefined();
      expect(PLAN_DEFINITIONS.platform.enterprise).toBeDefined();
    });

    it("should have correct platform starter plan details", async () => {
      const { PLAN_DEFINITIONS } = await import("../subscription.plans");
      expect(PLAN_DEFINITIONS.platform.starter).toEqual({
        name: "Starter",
        code: "starter",
        monthlyPrice: 49,
        currency: "USD",
        tier: 1,
        features: [
          "Online ordering",
          "Menu management",
          "Order management",
          "1 location",
        ],
        stripePriceEnvKey: "STRIPE_PLATFORM_STARTER_PRICE_ID",
      });
    });

    it("should have empty phone_ai plans for now", async () => {
      const { PLAN_DEFINITIONS } = await import("../subscription.plans");
      expect(Object.keys(PLAN_DEFINITIONS.phone_ai)).toHaveLength(0);
    });
  });

  describe("getPlanByCode", () => {
    it("should return a plan for a valid productLine and code", async () => {
      const { getPlanByCode } = await import("../subscription.plans");
      const plan = getPlanByCode("platform", "starter");
      expect(plan).toBeDefined();
      expect(plan?.code).toBe("starter");
    });

    it("should return undefined for invalid code", async () => {
      const { getPlanByCode } = await import("../subscription.plans");
      expect(getPlanByCode("platform", "nonexistent")).toBeUndefined();
    });

    it("should return undefined for invalid productLine", async () => {
      const { getPlanByCode } = await import("../subscription.plans");
      expect(getPlanByCode("nonexistent" as "platform", "starter")).toBeUndefined();
    });
  });

  describe("getStripePriceId", () => {
    it("should return the env value for a valid plan", async () => {
      process.env.STRIPE_PLATFORM_STARTER_PRICE_ID = "price_starter_123";
      const { getStripePriceId } = await import("../subscription.plans");
      expect(getStripePriceId("platform", "starter")).toBe("price_starter_123");
    });

    it("should return undefined when env var is not set", async () => {
      delete process.env.STRIPE_PLATFORM_STARTER_PRICE_ID;
      const { getStripePriceId } = await import("../subscription.plans");
      expect(getStripePriceId("platform", "starter")).toBeUndefined();
    });

    it("should return undefined for invalid plan code", async () => {
      const { getStripePriceId } = await import("../subscription.plans");
      expect(getStripePriceId("platform", "nonexistent")).toBeUndefined();
    });
  });

  describe("getPlanByStripePriceId", () => {
    it("should return productLine and plan for a known price id", async () => {
      process.env.STRIPE_PLATFORM_STARTER_PRICE_ID = "price_starter_abc";
      process.env.STRIPE_PLATFORM_PRO_PRICE_ID = "price_pro_abc";
      process.env.STRIPE_PLATFORM_ENTERPRISE_PRICE_ID = "price_enterprise_abc";

      const { getPlanByStripePriceId } = await import("../subscription.plans");
      const result = getPlanByStripePriceId("price_pro_abc");
      expect(result).toBeDefined();
      expect(result?.productLine).toBe("platform");
      expect(result?.plan.code).toBe("pro");
    });

    it("should return undefined when no plan matches", async () => {
      process.env.STRIPE_PLATFORM_STARTER_PRICE_ID = "price_starter_abc";
      const { getPlanByStripePriceId } = await import("../subscription.plans");
      expect(getPlanByStripePriceId("price_unknown")).toBeUndefined();
    });
  });

  describe("getAllPlans", () => {
    it("should return all plans for a given product line", async () => {
      const { getAllPlans } = await import("../subscription.plans");
      const plans = getAllPlans("platform");
      expect(plans).toHaveLength(3);
      expect(plans[0].code).toBe("starter");
      expect(plans[1].code).toBe("pro");
      expect(plans[2].code).toBe("enterprise");
    });

    it("should return empty array for product line with no plans", async () => {
      const { getAllPlans } = await import("../subscription.plans");
      const plans = getAllPlans("phone_ai");
      expect(plans).toHaveLength(0);
    });
  });

  describe("getPlanTier", () => {
    it("should return correct tier for platform plans", async () => {
      const { getPlanTier } = await import("../subscription.plans");
      expect(getPlanTier("platform", "free")).toBe(0);
      expect(getPlanTier("platform", "starter")).toBe(1);
      expect(getPlanTier("platform", "pro")).toBe(2);
      expect(getPlanTier("platform", "enterprise")).toBe(3);
    });

    it("should return 0 for unknown plan codes", async () => {
      const { getPlanTier } = await import("../subscription.plans");
      expect(getPlanTier("platform", "nonexistent")).toBe(0);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/services/subscription/__tests__/subscription.plans.test.ts`
Expected: FAIL — `PRODUCT_LINES` is not exported, `getPlanByCode` expects 1 argument not 2, etc.

- [ ] **Step 3: Update subscription.types.ts**

Replace `src/services/subscription/subscription.types.ts`:

```typescript
// ==================== Product Lines ====================

export const PRODUCT_LINES = ["platform", "phone_ai"] as const;

export type ProductLine = (typeof PRODUCT_LINES)[number];

export const PRODUCT_LINE_NAMES: Record<ProductLine, string> = {
  platform: "Online Ordering Platform",
  phone_ai: "Phone AI Ordering",
};

// ==================== Subscription Status ====================

export const SUBSCRIPTION_STATUSES = [
  "incomplete",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "paused",
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

// ==================== Subscription Plan ====================

export const SUBSCRIPTION_PLANS = ["free", "starter", "pro", "enterprise"] as const;

export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];

// ==================== Subscription Info ====================

export interface SubscriptionInfo {
  id: string;
  tenantId: string;
  productLine: ProductLine;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  status: SubscriptionStatus;
  plan: SubscriptionPlan;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  trialStart: Date | null;
  trialEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
  gracePeriodEnd: Date | null;
  // Computed fields
  isInGracePeriod: boolean;
  canAccessPremiumFeatures: boolean;
  trialDaysRemaining: number | null;
}

// ==================== API Request/Response Types ====================

export interface CreateCheckoutSessionRequest {
  planCode: string;
  successUrl?: string;
  cancelUrl?: string;
}

export interface CreateCheckoutSessionResponse {
  url: string;
  sessionId: string;
}

export interface CreateBillingPortalRequest {
  returnUrl?: string;
}

export interface CreateBillingPortalResponse {
  url: string;
}

export interface CancelSubscriptionRequest {
  cancelImmediately?: boolean;
}

export interface ChangePlanRequest {
  planCode: string;
}

export interface SubscriptionResponse {
  subscription: SubscriptionInfo | null;
}

// ==================== Multi-Product Line API Types ====================

export interface ProductLineSubscriptionInfo {
  productLine: ProductLine;
  name: string;
  subscription: SubscriptionInfo | null;
  availablePlans: {
    code: string;
    name: string;
    monthlyPrice: number;
    currency: string;
    features: string[];
    recommended?: boolean;
  }[];
}

export interface AllSubscriptionsResponse {
  productLines: ProductLineSubscriptionInfo[];
}

// ==================== Webhook Event Data ====================

export interface StripeSubscriptionData {
  id: string;
  customer: string;
  status: string;
  current_period_start: number;
  current_period_end: number;
  trial_start: number | null;
  trial_end: number | null;
  cancel_at_period_end: boolean;
  canceled_at: number | null;
  items: {
    data: Array<{
      price: {
        id: string;
      };
    }>;
  };
  metadata: {
    tenantId?: string;
    productLine?: string;
  };
}

export interface StripeInvoiceData {
  id: string;
  customer: string;
  subscription: string | null;
  status: string;
  amount_paid: number;
  amount_due: number;
  currency: string;
}

export interface StripeCheckoutSessionData {
  id: string;
  customer: string;
  subscription: string | null;
  mode: "subscription" | "payment" | "setup";
  metadata: {
    tenantId?: string;
    productLine?: string;
  };
}

// ==================== Service Method Types ====================

export interface CheckoutSessionOptions {
  successUrl: string;
  cancelUrl: string;
}

// ==================== Dashboard Context Subscription ====================

export interface DashboardSubscriptionInfo {
  status: SubscriptionStatus;
  plan: SubscriptionPlan;
  canAccessPremiumFeatures: boolean;
  isTrialing: boolean;
  trialDaysRemaining: number | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
}
```

- [ ] **Step 4: Update subscription.plans.ts**

Replace `src/services/subscription/subscription.plans.ts`:

```typescript
import type { ProductLine } from "./subscription.types";

// ==================== Plan Definitions ====================

export interface PlanDefinition {
  name: string;
  code: string;
  monthlyPrice: number;
  currency: string;
  tier: number;
  features: string[];
  stripePriceEnvKey: string;
  recommended?: boolean;
}

export const PLAN_DEFINITIONS: Record<ProductLine, Record<string, PlanDefinition>> = {
  platform: {
    starter: {
      name: "Starter",
      code: "starter",
      monthlyPrice: 49,
      currency: "USD",
      tier: 1,
      features: [
        "Online ordering",
        "Menu management",
        "Order management",
        "1 location",
      ],
      stripePriceEnvKey: "STRIPE_PLATFORM_STARTER_PRICE_ID",
    },
    pro: {
      name: "Pro",
      code: "pro",
      monthlyPrice: 99,
      currency: "USD",
      tier: 2,
      features: [
        "Everything in Starter",
        "Loyalty program",
        "Gift cards",
        "Catering",
        "Up to 3 locations",
      ],
      stripePriceEnvKey: "STRIPE_PLATFORM_PRO_PRICE_ID",
      recommended: true,
    },
    enterprise: {
      name: "Enterprise",
      code: "enterprise",
      monthlyPrice: 199,
      currency: "USD",
      tier: 3,
      features: [
        "Everything in Pro",
        "Analytics & reporting",
        "Priority support",
        "Unlimited locations",
      ],
      stripePriceEnvKey: "STRIPE_PLATFORM_ENTERPRISE_PRICE_ID",
    },
  },
  phone_ai: {
    // Tiers to be defined later
  },
} as const satisfies Record<ProductLine, Record<string, PlanDefinition>>;

// ==================== Helper Functions ====================

export function getPlanByCode(productLine: ProductLine, code: string): PlanDefinition | undefined {
  const productPlans = PLAN_DEFINITIONS[productLine];
  if (!productPlans) return undefined;
  return productPlans[code];
}

export function getStripePriceId(productLine: ProductLine, planCode: string): string | undefined {
  const plan = getPlanByCode(productLine, planCode);
  if (!plan) return undefined;
  return process.env[plan.stripePriceEnvKey] ?? undefined;
}

export function getPlanByStripePriceId(
  stripePriceId: string
): { productLine: ProductLine; plan: PlanDefinition } | undefined {
  for (const productLine of PRODUCT_LINES) {
    const plans = PLAN_DEFINITIONS[productLine];
    for (const code of Object.keys(plans)) {
      const plan = plans[code];
      const envValue = process.env[plan.stripePriceEnvKey];
      if (envValue === stripePriceId) {
        return { productLine: productLine as ProductLine, plan };
      }
    }
  }
  return undefined;
}

export function getAllPlans(productLine: ProductLine): PlanDefinition[] {
  const plans = PLAN_DEFINITIONS[productLine];
  if (!plans) return [];
  return Object.values(plans);
}

export function getPlanTier(productLine: ProductLine, planCode: string): number {
  if (planCode === "free") return 0;
  const plan = getPlanByCode(productLine, planCode);
  return plan?.tier ?? 0;
}
```

- [ ] **Step 5: Update index.ts exports**

Replace `src/services/subscription/index.ts`:

```typescript
export { subscriptionService } from "./subscription.service";
export type {
  ProductLine,
  SubscriptionStatus,
  SubscriptionPlan,
  SubscriptionInfo,
  DashboardSubscriptionInfo,
  ProductLineSubscriptionInfo,
  AllSubscriptionsResponse,
  CreateCheckoutSessionRequest,
  CreateCheckoutSessionResponse,
  CreateBillingPortalRequest,
  CreateBillingPortalResponse,
  CancelSubscriptionRequest,
  ChangePlanRequest,
  SubscriptionResponse,
} from "./subscription.types";
export { PRODUCT_LINES, PRODUCT_LINE_NAMES } from "./subscription.types";
export { getAllPlans } from "./subscription.plans";
```

- [ ] **Step 6: Run plan tests to verify they pass**

Run: `npx vitest run src/services/subscription/__tests__/subscription.plans.test.ts`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add src/services/subscription/subscription.types.ts src/services/subscription/subscription.plans.ts src/services/subscription/index.ts src/services/subscription/__tests__/subscription.plans.test.ts
git commit -m "feat: add ProductLine type and reorganize plan definitions (#277)"
```

---

### Task 3: Update Repository Layer

**Files:**
- Modify: `src/repositories/subscription.repository.ts`
- Modify: `src/repositories/__tests__/subscription.repository.test.ts`

- [ ] **Step 1: Write failing tests for new repository signatures**

Update `src/repositories/__tests__/subscription.repository.test.ts` to test:
- `getByTenantId(tenantId, productLine)` — calls `findFirst` with `{ tenantId, productLine, deleted: false }`
- `getAllByTenantId(tenantId)` — calls `findMany` with `{ tenantId, deleted: false }`
- `create(tenantId, productLine, data)` — includes `productLine` in data
- `updateByTenantId(tenantId, productLine, data)` — uses `tenantId_productLine` unique constraint
- `exists(tenantId, productLine)` — includes `productLine` in where
- Removed: `updateTenantSubscriptionStatus` — should no longer exist
- Removed: `getWithTenant` — no longer selects `subscriptionPlan`/`subscriptionStatus`

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/repositories/__tests__/subscription.repository.test.ts`
Expected: FAIL

- [ ] **Step 3: Update subscription.repository.ts**

Replace `src/repositories/subscription.repository.ts`:

```typescript
import prisma from "@/lib/db";
import { generateEntityId } from "@/lib/id";
import type { ProductLine } from "@/services/subscription/subscription.types";

export interface CreateSubscriptionInput {
  stripeCustomerId: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  status?: string;
  plan?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  trialStart?: Date;
  trialEnd?: Date;
}

export interface UpdateSubscriptionInput {
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  status?: string;
  plan?: string;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  trialStart?: Date | null;
  trialEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: Date | null;
  gracePeriodEnd?: Date | null;
}

export class SubscriptionRepository {
  async getByTenantId(tenantId: string, productLine: ProductLine) {
    return prisma.subscription.findFirst({
      where: { tenantId, productLine, deleted: false },
    });
  }

  async getAllByTenantId(tenantId: string) {
    return prisma.subscription.findMany({
      where: { tenantId, deleted: false },
    });
  }

  async getByStripeCustomerId(stripeCustomerId: string) {
    return prisma.subscription.findFirst({
      where: { stripeCustomerId, deleted: false },
    });
  }

  async getByStripeSubscriptionId(stripeSubscriptionId: string) {
    return prisma.subscription.findFirst({
      where: { stripeSubscriptionId, deleted: false },
    });
  }

  async create(tenantId: string, productLine: ProductLine, data: CreateSubscriptionInput) {
    return prisma.subscription.create({
      data: {
        id: generateEntityId(),
        tenantId,
        productLine,
        stripeCustomerId: data.stripeCustomerId,
        stripeSubscriptionId: data.stripeSubscriptionId,
        stripePriceId: data.stripePriceId,
        status: data.status ?? "incomplete",
        plan: data.plan ?? "free",
        currentPeriodStart: data.currentPeriodStart,
        currentPeriodEnd: data.currentPeriodEnd,
        trialStart: data.trialStart,
        trialEnd: data.trialEnd,
      },
    });
  }

  async update(id: string, data: UpdateSubscriptionInput) {
    return prisma.subscription.update({
      where: { id },
      data,
    });
  }

  async updateByTenantId(tenantId: string, productLine: ProductLine, data: UpdateSubscriptionInput) {
    return prisma.subscription.update({
      where: { tenantId_productLine: { tenantId, productLine } },
      data,
    });
  }

  async updateByStripeSubscriptionId(
    stripeSubscriptionId: string,
    data: UpdateSubscriptionInput
  ) {
    return prisma.subscription.update({
      where: { stripeSubscriptionId },
      data,
    });
  }

  async delete(id: string) {
    return prisma.subscription.update({
      where: { id },
      data: { deleted: true, updatedAt: new Date() },
    });
  }

  async deleteByTenantId(tenantId: string, productLine: ProductLine) {
    return prisma.subscription.update({
      where: { tenantId_productLine: { tenantId, productLine } },
      data: { deleted: true, updatedAt: new Date() },
    });
  }

  async exists(tenantId: string, productLine: ProductLine): Promise<boolean> {
    const count = await prisma.subscription.count({
      where: { tenantId, productLine, deleted: false },
    });
    return count > 0;
  }
}

export const subscriptionRepository = new SubscriptionRepository();
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/repositories/__tests__/subscription.repository.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/repositories/subscription.repository.ts src/repositories/__tests__/subscription.repository.test.ts
git commit -m "feat: update subscription repository for productLine composite key (#277)"
```

---

### Task 4: Update Subscription Service

**Files:**
- Modify: `src/services/subscription/subscription.service.ts`
- Modify: `src/services/subscription/__tests__/subscription.service.test.ts`

- [ ] **Step 1: Update subscription.service.ts**

Key changes:
1. All read methods gain `productLine` parameter: `getSubscription(tenantId, productLine)`, `getSubscriptionForDashboard(tenantId, productLine)`, `isSubscriptionActive(tenantId, productLine)`, `canAccessPremiumFeatures(tenantId, productLine)`
2. New method: `getAllSubscriptions(tenantId)` — returns all product line subscriptions
3. All management methods gain `productLine` parameter: `createCheckoutSession(tenantId, productLine, planCode, options)`, `cancelSubscription(tenantId, productLine, cancelImmediately)`, `resumeSubscription(tenantId, productLine)`, `changePlan(tenantId, productLine, newPlanCode)`
4. `createBillingPortalSession(tenantId, returnUrl)` — unchanged (customer-level)
5. Remove all calls to `this.updateTenantSubscriptionStatus(...)` (6 places: `changePlan`, `handleCheckoutSessionCompleted`, `handleSubscriptionCreated`, `handleSubscriptionUpdated`, `handleSubscriptionDeleted`, `handleInvoicePaymentSucceeded`, `handleInvoicePaymentFailed`)
6. Remove the `updateTenantSubscriptionStatus` private method entirely
7. `getOrCreateStripeCustomer` — change to look up any subscription for the tenant: `subscriptionRepository.getAllByTenantId(tenantId)`, take the first one's `stripeCustomerId`, or create new customer. When creating, also create the subscription record with `productLine`.
8. `toSubscriptionInfo` — add `productLine` to the returned object
9. Plan lookup calls gain `productLine`: `getPlanByCode(productLine, planCode)`, `getStripePriceId(productLine, planCode)`. For webhook handlers, use `getPlanByStripePriceId(priceId)` which returns `{ productLine, plan }`.
10. Webhook handlers: after finding the subscription via `getByStripeSubscriptionId`, read `productLine` from the record. When creating via `handleSubscriptionCreated`, read `productLine` from metadata (fallback to `"platform"`). When calling `repository.create`, pass `productLine`. When calling `repository.updateByTenantId`, pass `productLine`.
11. `handleCheckoutSessionCompleted` — read `productLine` from `session.metadata.productLine ?? "platform"`. Pass to `repository.create(tenantId, productLine, ...)` and `repository.updateByTenantId(tenantId, productLine, ...)`.
12. `createCheckoutSession` — include `productLine` in Stripe checkout session metadata so webhooks can read it back.

- [ ] **Step 2: Update subscription.service.test.ts**

Key test changes:
1. Update env vars from `STRIPE_STARTER_PRICE_ID` to `STRIPE_PLATFORM_STARTER_PRICE_ID` (same for pro/enterprise)
2. Add `productLine: "platform"` to `activeSubscription` test fixture
3. Update all mock calls: `subscriptionRepository.getByTenantId` → called with `("tenant-1", "platform")`
4. Update `repository.create` calls → include `"platform"` as second arg
5. Update `repository.updateByTenantId` calls → include `"platform"` as second arg
6. Remove all `subscriptionRepository.updateTenantSubscriptionStatus` from mock and assertions
7. Add `getAllByTenantId` to the mock
8. Update `getOrCreateStripeCustomer` tests: mock `getAllByTenantId` instead of `getByTenantId` for customer lookup
9. Webhook handler tests: ensure `productLine` is read from the subscription record

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/services/subscription/__tests__/subscription.service.test.ts`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add src/services/subscription/subscription.service.ts src/services/subscription/__tests__/subscription.service.test.ts
git commit -m "feat: add productLine parameter to subscription service methods (#277)"
```

---

### Task 5: Remove Tenant Denormalized Fields from Dependent Code

**Files:**
- Modify: `src/types/tenant.ts:20-21` — remove `subscriptionPlan`, `subscriptionStatus`
- Modify: `src/services/merchant/merchant.types.ts:47,62` — remove `subscriptionStatus`
- Modify: `src/services/merchant/merchant.mapper.ts:61,80,121` — remove `subscriptionStatus` mapping
- Modify: `src/services/tenant/tenant.service.ts:58,92` — remove `subscriptionStatus` param
- Modify: `src/services/generator/generator.service.ts:78` — remove `subscriptionStatus: "trial"`
- Modify: `src/app/api/auth/claim/route.ts:36,54` — remove subscription status check/update
- Modify: `src/app/(storefront)/r/[merchantSlug]/layout.tsx:41` — remove `isTrial` check
- Modify: `src/app/(storefront)/[companySlug]/layout.tsx:42` — remove `isTrial` check

- [ ] **Step 1: Update src/types/tenant.ts**

Remove `subscriptionPlan` and `subscriptionStatus` from `TenantInfo` interface (lines 20-21).

- [ ] **Step 2: Update src/services/merchant/merchant.types.ts**

Remove `subscriptionStatus: string` from the `tenant` object in `MerchantWithTenant` (line 47) and from `TenantWithMerchants` (line 62).

- [ ] **Step 3: Update src/services/merchant/merchant.mapper.ts**

Remove `subscriptionStatus: data.tenant.subscriptionStatus` from `toMerchantWithTenant` (line 61), `toTenantWithMerchants` (line 80), and `toMerchantFromTenant` (line 121).

- [ ] **Step 4: Update src/services/tenant/tenant.service.ts**

Remove `subscriptionStatus` from the `createTenantWithMerchant` input type (line 58) and from the `tenant.create` data (line 92).

- [ ] **Step 5: Update src/services/generator/generator.service.ts**

Remove `subscriptionStatus: "trial"` from the `createTenantWithMerchant` call (line 78).

- [ ] **Step 6: Update src/app/api/auth/claim/route.ts**

Remove the `tenant.subscriptionStatus !== "trial"` check (line 36) and the `prisma.tenant.update({ data: { subscriptionStatus: "active" } })` call (lines 52-55). The claim route should still create the user but no longer check/update subscription status on the Tenant table.

- [ ] **Step 7: Update storefront layouts**

In `src/app/(storefront)/r/[merchantSlug]/layout.tsx` (line 41): Remove `const isTrial = merchant?.tenant?.subscriptionStatus === "trial"` and the conditional `{isTrial && tenantId && <ClaimBar .../>}`.

In `src/app/(storefront)/[companySlug]/layout.tsx` (line 42): Remove `const isTrial = company.subscriptionStatus === "trial"` and any associated `ClaimBar` rendering.

- [ ] **Step 8: Update test files referencing removed fields**

Search and fix all test files that reference `subscriptionPlan` or `subscriptionStatus`:
- `src/services/merchant/__tests__/merchant.service.unit.test.ts` — remove from mock data
- `src/services/generator/__tests__/generator.service.test.ts` — remove from assertions
- `src/repositories/__tests__/merchant.repository.test.ts` — remove from mock data
- `src/repositories/__tests__/tenant.repository.test.ts` — remove from mock data
- `src/app/api/auth/__tests__/claim.route.test.ts` — update test assertions
- `src/app/api/external/v1/__tests__/phone-ai-flow.integration.test.ts` — remove from mock data
- `src/repositories/__tests__/subscription.repository.test.ts` — remove `updateTenantSubscriptionStatus` tests

- [ ] **Step 9: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors. All references to removed fields should be cleaned up.

- [ ] **Step 10: Run full test suite**

Run: `npm run test:run`
Expected: ALL PASS

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "refactor: remove Tenant subscription denormalized fields (#277)"
```

---

### Task 6: Update API Routes with [productLine] Dynamic Segment

**Files:**
- Modify: `src/app/api/dashboard/subscription/route.ts`
- Create: `src/app/api/dashboard/subscription/[productLine]/checkout/route.ts`
- Create: `src/app/api/dashboard/subscription/[productLine]/change-plan/route.ts`
- Create: `src/app/api/dashboard/subscription/[productLine]/cancel/route.ts`
- Create: `src/app/api/dashboard/subscription/[productLine]/resume/route.ts`
- Remove old routes: `src/app/api/dashboard/subscription/checkout/route.ts`, `change-plan/route.ts`, `cancel/route.ts`, `resume/route.ts`, `plans/route.ts`

- [ ] **Step 1: Update GET /api/dashboard/subscription**

Replace `src/app/api/dashboard/subscription/route.ts` to return all product lines overview:

```typescript
import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api";
import { auth } from "@/lib/auth";
import { subscriptionService } from "@/services/subscription";
import { PRODUCT_LINES, PRODUCT_LINE_NAMES } from "@/services/subscription";
import { getAllPlans } from "@/services/subscription";
import type { ProductLineSubscriptionInfo } from "@/services/subscription";

export const GET = withApiHandler(async () => {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const productLines: ProductLineSubscriptionInfo[] = await Promise.all(
    PRODUCT_LINES.map(async (productLine) => {
      const subscription = await subscriptionService.getSubscription(
        session.user.tenantId,
        productLine
      );
      const plans = getAllPlans(productLine);

      return {
        productLine,
        name: PRODUCT_LINE_NAMES[productLine],
        subscription,
        availablePlans: plans.map((plan) => ({
          code: plan.code,
          name: plan.name,
          monthlyPrice: plan.monthlyPrice,
          currency: plan.currency,
          features: plan.features,
          recommended: plan.recommended,
        })),
      };
    })
  );

  return NextResponse.json({
    success: true,
    data: { productLines },
  });
});
```

- [ ] **Step 2: Create productLine validation helper**

Create a shared validation at the top of each `[productLine]` route, or inline it. The pattern:

```typescript
import { PRODUCT_LINES, type ProductLine } from "@/services/subscription/subscription.types";

function validateProductLine(productLine: string): productLine is ProductLine {
  return (PRODUCT_LINES as readonly string[]).includes(productLine);
}
```

- [ ] **Step 3: Create [productLine]/checkout/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api";
import { auth } from "@/lib/auth";
import { subscriptionService } from "@/services/subscription";
import { PRODUCT_LINES, type ProductLine } from "@/services/subscription/subscription.types";

export const POST = withApiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ productLine: string }> }) => {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { productLine } = await params;
    if (!(PRODUCT_LINES as readonly string[]).includes(productLine)) {
      return NextResponse.json(
        { success: false, error: "Invalid product line" },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { planCode, successUrl, cancelUrl } = body as {
      planCode?: string;
      successUrl?: string;
      cancelUrl?: string;
    };

    if (!planCode) {
      return NextResponse.json(
        { success: false, error: "planCode is required" },
        { status: 400 }
      );
    }

    const result = await subscriptionService.createCheckoutSession(
      session.user.tenantId,
      productLine as ProductLine,
      planCode,
      { successUrl, cancelUrl }
    );

    return NextResponse.json({
      success: true,
      data: { url: result.url, sessionId: result.sessionId },
    });
  }
);
```

- [ ] **Step 4: Create [productLine]/change-plan/route.ts**

Same pattern as checkout, calling `subscriptionService.changePlan(tenantId, productLine, planCode)`.

- [ ] **Step 5: Create [productLine]/cancel/route.ts**

Same pattern, calling `subscriptionService.cancelSubscription(tenantId, productLine, cancelImmediately)`.

- [ ] **Step 6: Create [productLine]/resume/route.ts**

Same pattern, calling `subscriptionService.resumeSubscription(tenantId, productLine)`.

- [ ] **Step 7: Delete old routes**

Delete the old route files that are now under `[productLine]`:
- `src/app/api/dashboard/subscription/checkout/route.ts`
- `src/app/api/dashboard/subscription/change-plan/route.ts`
- `src/app/api/dashboard/subscription/cancel/route.ts`
- `src/app/api/dashboard/subscription/resume/route.ts`
- `src/app/api/dashboard/subscription/plans/route.ts`

Portal route stays unchanged at `src/app/api/dashboard/subscription/portal/route.ts`.

- [ ] **Step 8: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add [productLine] dynamic segment to subscription API routes (#277)"
```

---

### Task 7: Update Dashboard UI

**Files:**
- Create: `src/components/dashboard/subscription/ProductLineSection.tsx`
- Modify: `src/components/dashboard/subscription/SubscriptionClient.tsx`
- Modify: `src/app/(dashboard)/dashboard/(protected)/subscription/page.tsx`

- [ ] **Step 1: Create ProductLineSection component**

Create `src/components/dashboard/subscription/ProductLineSection.tsx`:

This component renders a single product line section with:
- Product line name as a heading
- Current subscription info card (if subscribed): plan name, status badge, billing period
- Banners: trial, past_due, cancellation (moved from SubscriptionClient)
- Pricing cards grid (if plans available)
- "Coming Soon" badge if no plans defined
- Action handlers: subscribe, changePlan, cancel, resume, manageBilling (passed as props from parent)

Props interface:
```typescript
interface ProductLineSectionProps {
  productLine: string;
  name: string;
  subscription: SubscriptionInfo | null;
  availablePlans: PlanInfo[];
  isLoading: boolean;
  onSubscribe: (productLine: string, planCode: string) => void;
  onChangePlan: (productLine: string, planCode: string) => void;
  onCancel: (productLine: string) => void;
  onResume: (productLine: string) => void;
  onManageBilling: () => void;
}
```

- [ ] **Step 2: Refactor SubscriptionClient**

Update `src/components/dashboard/subscription/SubscriptionClient.tsx`:

1. Remove separate plans fetch — plans come from the overview API
2. Fetch from `GET /api/dashboard/subscription` which returns `{ productLines: [...] }`
3. Loop through `productLines` and render a `ProductLineSection` for each
4. Action handlers now include `productLine` in API calls:
   - `handleSubscribe(productLine, planCode)` → `POST /api/dashboard/subscription/${productLine}/checkout`
   - `handleChangePlan(productLine, planCode)` → `POST /api/dashboard/subscription/${productLine}/change-plan`
   - `handleCancel(productLine)` → `POST /api/dashboard/subscription/${productLine}/cancel`
   - `handleResume(productLine)` → `POST /api/dashboard/subscription/${productLine}/resume`
   - `handleManageBilling()` → unchanged, `POST /api/dashboard/subscription/portal`

- [ ] **Step 3: Update subscription page server component**

Update `src/app/(dashboard)/dashboard/(protected)/subscription/page.tsx`:

Since SubscriptionClient now fetches its own data client-side (overview API), the server component no longer needs to pre-fetch. Simplify to:

```typescript
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SubscriptionClient } from "@/components/dashboard/subscription";

export default async function SubscriptionPage() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    redirect("/dashboard/login");
  }
  return <SubscriptionClient />;
}
```

- [ ] **Step 4: Update component barrel export if needed**

Check `src/components/dashboard/subscription/index.ts` and ensure `ProductLineSection` is exported.

- [ ] **Step 5: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Run lint**

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: update dashboard UI for multi-product line subscriptions (#277)"
```

---

### Task 8: Update Seed Data and Environment Variables

**Files:**
- Modify: `prisma/seed.ts` — remove `subscriptionPlan` from tenant creation
- Modify: `.env.example` — update Stripe price ID env var names

- [ ] **Step 1: Update prisma/seed.ts**

Search for all `subscriptionPlan: "free"` or `subscriptionPlan` references in seed.ts and remove them. Also remove any `subscriptionStatus` references.

- [ ] **Step 2: Update .env.example**

Rename env vars:
```
# Old (remove)
STRIPE_STARTER_PRICE_ID=
STRIPE_PRO_PRICE_ID=
STRIPE_ENTERPRISE_PRICE_ID=

# New
STRIPE_PLATFORM_STARTER_PRICE_ID=
STRIPE_PLATFORM_PRO_PRICE_ID=
STRIPE_PLATFORM_ENTERPRISE_PRICE_ID=
```

- [ ] **Step 3: Commit**

```bash
git add prisma/seed.ts .env.example
git commit -m "chore: update seed data and env vars for multi-product subscription (#277)"
```

---

### Task 9: Full Build and Test Verification

- [ ] **Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 3: Run full test suite**

Run: `npm run test:run`
Expected: ALL PASS. Check output for ERROR lines (not just pass/fail).

- [ ] **Step 4: Fix any issues found**

If any tests fail or type errors appear, fix them before proceeding.

- [ ] **Step 5: Final commit if fixes were needed**

```bash
git add -A
git commit -m "fix: resolve build/test issues for multi-product subscription (#277)"
```
