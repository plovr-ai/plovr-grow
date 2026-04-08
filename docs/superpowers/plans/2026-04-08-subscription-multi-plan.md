# Subscription Multi-Plan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the subscription system to support multiple plan tiers (Starter/Pro/Enterprise) with Stripe proration for upgrade/downgrade.

**Architecture:** Plans defined as code constants in `subscription.plans.ts`, mapped to Stripe Price IDs via environment variables. Existing `Subscription` model reused with expanded plan values. New `changePlan` service method uses Stripe Subscription Update with proration. Dashboard UI shows pricing cards for plan selection and switching.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Prisma, Stripe SDK, Vitest, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-04-08-subscription-multi-plan-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/services/subscription/subscription.plans.ts` | Create | Plan definitions, lookup helpers |
| `src/services/subscription/__tests__/subscription.plans.test.ts` | Create | Tests for plan helpers |
| `src/services/subscription/subscription.types.ts` | Modify | Update SubscriptionPlan type, add ChangePlanRequest |
| `src/services/subscription/subscription.service.ts` | Modify | Add planCode param to checkout, add changePlan method, update webhook plan detection |
| `src/services/subscription/__tests__/subscription.service.test.ts` | Create | Tests for changePlan and updated checkout |
| `src/services/subscription/index.ts` | Modify | Re-export new types |
| `src/services/stripe/stripe.types.ts` | Modify | Add UpdateSubscriptionPriceInput type |
| `src/services/stripe/stripe.service.ts` | Modify | Add updateSubscriptionPrice method |
| `src/repositories/subscription.repository.ts` | Modify | Change default plan from "standard" to "starter" |
| `src/app/api/dashboard/subscription/plans/route.ts` | Create | GET plan list endpoint |
| `src/app/api/dashboard/subscription/checkout/route.ts` | Modify | Accept planCode in body |
| `src/app/api/dashboard/subscription/change-plan/route.ts` | Create | POST change plan endpoint |
| `src/components/dashboard/subscription/PricingCard.tsx` | Create | Reusable pricing card component |
| `src/components/dashboard/subscription/SubscriptionClient.tsx` | Modify | Pricing cards UI, upgrade/downgrade flow |
| `src/components/dashboard/subscription/index.ts` | Modify | Re-export PricingCard |
| `src/hooks/useSubscription.ts` | Modify | No code change needed — types auto-update |
| `.env.example` | Modify | Replace STRIPE_STANDARD_PRICE_ID with per-plan IDs |

---

## Task 1: Plan Definitions and Helpers

**Files:**
- Create: `src/services/subscription/subscription.plans.ts`
- Create: `src/services/subscription/__tests__/subscription.plans.test.ts`

- [ ] **Step 1: Write tests for plan helpers**

Create `src/services/subscription/__tests__/subscription.plans.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const originalEnv = process.env;

describe("subscription.plans", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...originalEnv,
      STRIPE_STARTER_PRICE_ID: "price_starter_test",
      STRIPE_PRO_PRICE_ID: "price_pro_test",
      STRIPE_ENTERPRISE_PRICE_ID: "price_enterprise_test",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("getPlanByCode", () => {
    it("should return plan definition for valid code", async () => {
      const { getPlanByCode } = await import("../subscription.plans");
      const plan = getPlanByCode("starter");
      expect(plan).toBeDefined();
      expect(plan!.name).toBe("Starter");
      expect(plan!.code).toBe("starter");
      expect(plan!.monthlyPrice).toBe(49);
    });

    it("should return undefined for invalid code", async () => {
      const { getPlanByCode } = await import("../subscription.plans");
      const plan = getPlanByCode("nonexistent");
      expect(plan).toBeUndefined();
    });

    it("should return all three plans", async () => {
      const { getPlanByCode } = await import("../subscription.plans");
      expect(getPlanByCode("starter")).toBeDefined();
      expect(getPlanByCode("pro")).toBeDefined();
      expect(getPlanByCode("enterprise")).toBeDefined();
    });
  });

  describe("getStripePriceId", () => {
    it("should return price ID from environment for valid plan", async () => {
      const { getStripePriceId } = await import("../subscription.plans");
      expect(getStripePriceId("starter")).toBe("price_starter_test");
      expect(getStripePriceId("pro")).toBe("price_pro_test");
      expect(getStripePriceId("enterprise")).toBe("price_enterprise_test");
    });

    it("should return undefined for invalid plan code", async () => {
      const { getStripePriceId } = await import("../subscription.plans");
      expect(getStripePriceId("nonexistent")).toBeUndefined();
    });

    it("should return undefined when env var is not set", async () => {
      delete process.env.STRIPE_STARTER_PRICE_ID;
      const { getStripePriceId } = await import("../subscription.plans");
      expect(getStripePriceId("starter")).toBeUndefined();
    });
  });

  describe("getPlanByStripePriceId", () => {
    it("should reverse-lookup plan code from Stripe price ID", async () => {
      const { getPlanByStripePriceId } = await import("../subscription.plans");
      const plan = getPlanByStripePriceId("price_pro_test");
      expect(plan).toBeDefined();
      expect(plan!.code).toBe("pro");
    });

    it("should return undefined for unknown price ID", async () => {
      const { getPlanByStripePriceId } = await import("../subscription.plans");
      expect(getPlanByStripePriceId("price_unknown")).toBeUndefined();
    });
  });

  describe("getAllPlans", () => {
    it("should return all plans in order", async () => {
      const { getAllPlans } = await import("../subscription.plans");
      const plans = getAllPlans();
      expect(plans).toHaveLength(3);
      expect(plans[0].code).toBe("starter");
      expect(plans[1].code).toBe("pro");
      expect(plans[2].code).toBe("enterprise");
    });
  });

  describe("getPlanTier", () => {
    it("should return correct tier numbers for ordering", async () => {
      const { getPlanTier } = await import("../subscription.plans");
      expect(getPlanTier("free")).toBe(0);
      expect(getPlanTier("starter")).toBe(1);
      expect(getPlanTier("pro")).toBe(2);
      expect(getPlanTier("enterprise")).toBe(3);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run --testPathPattern="subscription.plans.test"`
Expected: FAIL — module `../subscription.plans` not found

- [ ] **Step 3: Implement plan definitions**

Create `src/services/subscription/subscription.plans.ts`:

```typescript
export interface PlanDefinition {
  name: string;
  code: string;
  monthlyPrice: number;
  currency: string;
  features: string[];
  stripePriceEnvKey: string;
}

const PLAN_DEFINITIONS: Record<string, PlanDefinition> = {
  starter: {
    name: "Starter",
    code: "starter",
    monthlyPrice: 49,
    currency: "USD",
    features: [
      "Online ordering",
      "Menu management",
      "Order management",
      "1 location",
    ],
    stripePriceEnvKey: "STRIPE_STARTER_PRICE_ID",
  },
  pro: {
    name: "Pro",
    code: "pro",
    monthlyPrice: 99,
    currency: "USD",
    features: [
      "Everything in Starter",
      "Loyalty program",
      "Gift cards",
      "Catering",
      "Up to 3 locations",
    ],
    stripePriceEnvKey: "STRIPE_PRO_PRICE_ID",
  },
  enterprise: {
    name: "Enterprise",
    code: "enterprise",
    monthlyPrice: 199,
    currency: "USD",
    features: [
      "Everything in Pro",
      "Analytics & reporting",
      "Priority support",
      "Unlimited locations",
    ],
    stripePriceEnvKey: "STRIPE_ENTERPRISE_PRICE_ID",
  },
};

const PLAN_ORDER = ["starter", "pro", "enterprise"];

const PLAN_TIER_MAP: Record<string, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  enterprise: 3,
};

export function getPlanByCode(code: string): PlanDefinition | undefined {
  return PLAN_DEFINITIONS[code];
}

export function getStripePriceId(planCode: string): string | undefined {
  const plan = PLAN_DEFINITIONS[planCode];
  if (!plan) return undefined;
  return process.env[plan.stripePriceEnvKey] || undefined;
}

export function getPlanByStripePriceId(
  stripePriceId: string
): PlanDefinition | undefined {
  for (const plan of Object.values(PLAN_DEFINITIONS)) {
    const envPriceId = process.env[plan.stripePriceEnvKey];
    if (envPriceId === stripePriceId) {
      return plan;
    }
  }
  return undefined;
}

export function getAllPlans(): PlanDefinition[] {
  return PLAN_ORDER.map((code) => PLAN_DEFINITIONS[code]);
}

export function getPlanTier(planCode: string): number {
  return PLAN_TIER_MAP[planCode] ?? 0;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run --testPathPattern="subscription.plans.test"`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/subscription/subscription.plans.ts src/services/subscription/__tests__/subscription.plans.test.ts
git commit -m "feat: add subscription plan definitions and helpers (#13)"
```

---

## Task 2: Update Types

**Files:**
- Modify: `src/services/subscription/subscription.types.ts`
- Modify: `src/services/subscription/index.ts`

- [ ] **Step 1: Update SubscriptionPlan type and add new request types**

In `src/services/subscription/subscription.types.ts`:

Replace:
```typescript
export const SUBSCRIPTION_PLANS = ["free", "standard"] as const;
```
With:
```typescript
export const SUBSCRIPTION_PLANS = ["free", "starter", "pro", "enterprise"] as const;
```

Add after `CancelSubscriptionRequest`:
```typescript
export interface ChangePlanRequest {
  planCode: string;
}
```

Add `planCode` to `CreateCheckoutSessionRequest`:
```typescript
export interface CreateCheckoutSessionRequest {
  planCode: string;
  successUrl?: string;
  cancelUrl?: string;
}
```

- [ ] **Step 2: Update index.ts re-exports**

In `src/services/subscription/index.ts`, add to the type exports:
```typescript
export type { ChangePlanRequest } from "./subscription.types";
```

Also add plan helper exports:
```typescript
export {
  getPlanByCode,
  getStripePriceId,
  getPlanByStripePriceId,
  getAllPlans,
  getPlanTier,
} from "./subscription.plans";
export type { PlanDefinition } from "./subscription.plans";
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors (existing code still compiles — `SubscriptionPlan` type is a union of string literals, and existing "standard" values won't cause compile errors but will need runtime migration)

- [ ] **Step 4: Commit**

```bash
git add src/services/subscription/subscription.types.ts src/services/subscription/index.ts
git commit -m "feat: update subscription types for multi-plan support (#13)"
```

---

## Task 3: Add StripeService.updateSubscriptionPrice

**Files:**
- Modify: `src/services/stripe/stripe.types.ts`
- Modify: `src/services/stripe/stripe.service.ts`

- [ ] **Step 1: Add type to stripe.types.ts**

Append to `src/services/stripe/stripe.types.ts`:

```typescript
export interface UpdateSubscriptionPriceInput {
  subscriptionId: string;
  currentPriceId: string;
  newPriceId: string;
}
```

- [ ] **Step 2: Add updateSubscriptionPrice method to StripeService**

In `src/services/stripe/stripe.service.ts`, add after the `getSubscription` method (before the closing `}` of the class):

```typescript
  /**
   * Update subscription to a new price (plan change with proration)
   */
  async updateSubscriptionPrice(
    input: UpdateSubscriptionPriceInput
  ): Promise<StripeSubscriptionInfo | null> {
    if (this.isMockMode()) {
      console.log("[Stripe Mock] Updating subscription price:", {
        subscriptionId: input.subscriptionId,
        currentPriceId: input.currentPriceId,
        newPriceId: input.newPriceId,
      });
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      return {
        id: input.subscriptionId,
        status: "active",
        customerId: "mock_cus_123",
        priceId: input.newPriceId,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        trialStart: null,
        trialEnd: null,
        cancelAtPeriodEnd: false,
        canceledAt: null,
      };
    }

    try {
      // Retrieve the subscription to find the item ID
      const subscription = await stripe!.subscriptions.retrieve(
        input.subscriptionId
      );

      // Find the subscription item with the current price
      const item = subscription.items.data.find(
        (si) => si.price.id === input.currentPriceId
      );

      if (!item) {
        console.error(
          "[Stripe] Could not find subscription item with price:",
          input.currentPriceId
        );
        return null;
      }

      // Update the subscription item's price with proration
      const updated = await stripe!.subscriptions.update(
        input.subscriptionId,
        {
          items: [
            {
              id: item.id,
              price: input.newPriceId,
            },
          ],
          proration_behavior: "create_prorations",
        }
      );

      const firstItem = updated.items.data[0];
      return {
        id: updated.id,
        status: updated.status,
        customerId:
          typeof updated.customer === "string"
            ? updated.customer
            : updated.customer.id,
        priceId: firstItem?.price?.id || null,
        currentPeriodStart: firstItem
          ? new Date(firstItem.current_period_start * 1000)
          : new Date(),
        currentPeriodEnd: firstItem
          ? new Date(firstItem.current_period_end * 1000)
          : new Date(),
        trialStart: updated.trial_start
          ? new Date(updated.trial_start * 1000)
          : null,
        trialEnd: updated.trial_end
          ? new Date(updated.trial_end * 1000)
          : null,
        cancelAtPeriodEnd: updated.cancel_at_period_end,
        canceledAt: updated.canceled_at
          ? new Date(updated.canceled_at * 1000)
          : null,
      };
    } catch (err) {
      console.error("Failed to update subscription price:", err);
      return null;
    }
  }
```

- [ ] **Step 3: Add import for new type**

In `src/services/stripe/stripe.service.ts`, add `UpdateSubscriptionPriceInput` to the import from `./stripe.types`.

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/services/stripe/stripe.types.ts src/services/stripe/stripe.service.ts
git commit -m "feat: add Stripe updateSubscriptionPrice for plan changes (#13)"
```

---

## Task 4: Update SubscriptionService

**Files:**
- Modify: `src/services/subscription/subscription.service.ts`
- Create: `src/services/subscription/__tests__/subscription.service.test.ts`

- [ ] **Step 1: Write tests for updated service**

Create `src/services/subscription/__tests__/subscription.service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("@/services/stripe/stripe.service", () => ({
  stripeService: {
    createSubscriptionCheckoutSession: vi.fn(),
    createCustomer: vi.fn(),
    updateSubscriptionPrice: vi.fn(),
    getSubscription: vi.fn(),
  },
}));

vi.mock("@/repositories/subscription.repository", () => ({
  subscriptionRepository: {
    getByTenantId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateByTenantId: vi.fn(),
    updateTenantSubscriptionStatus: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  default: {
    tenant: {
      findUnique: vi.fn(),
    },
  },
}));

// Set env vars before importing the service
process.env.STRIPE_STARTER_PRICE_ID = "price_starter_test";
process.env.STRIPE_PRO_PRICE_ID = "price_pro_test";
process.env.STRIPE_ENTERPRISE_PRICE_ID = "price_enterprise_test";
process.env.STRIPE_TRIAL_DAYS = "14";
process.env.STRIPE_GRACE_PERIOD_DAYS = "7";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";

import { SubscriptionService } from "../subscription.service";
import { stripeService } from "@/services/stripe/stripe.service";
import { subscriptionRepository } from "@/repositories/subscription.repository";

const mockStripeService = vi.mocked(stripeService);
const mockRepo = vi.mocked(subscriptionRepository);

describe("SubscriptionService", () => {
  let service: SubscriptionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SubscriptionService();
  });

  describe("createCheckoutSession", () => {
    it("should use the correct Stripe price ID for the given plan code", async () => {
      mockRepo.getByTenantId.mockResolvedValue({
        id: "sub-1",
        tenantId: "tenant-1",
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: null,
        stripePriceId: null,
        status: "incomplete",
        plan: "free",
        currentPeriodStart: null,
        currentPeriodEnd: null,
        trialStart: null,
        trialEnd: null,
        cancelAtPeriodEnd: false,
        canceledAt: null,
        gracePeriodEnd: null,
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockStripeService.createSubscriptionCheckoutSession.mockResolvedValue({
        sessionId: "cs_123",
        url: "https://checkout.stripe.com/session",
      });

      const result = await service.createCheckoutSession("tenant-1", "pro");

      expect(
        mockStripeService.createSubscriptionCheckoutSession
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          priceId: "price_pro_test",
          tenantId: "tenant-1",
        })
      );
      expect(result.url).toBe("https://checkout.stripe.com/session");
    });

    it("should throw when plan code is invalid", async () => {
      await expect(
        service.createCheckoutSession("tenant-1", "nonexistent")
      ).rejects.toThrow("Invalid plan code");
    });

    it("should throw when Stripe price ID is not configured", async () => {
      const origVal = process.env.STRIPE_PRO_PRICE_ID;
      delete process.env.STRIPE_PRO_PRICE_ID;

      // Need to re-import to pick up env change for getStripePriceId
      // Since getStripePriceId reads env at call time, this works directly
      await expect(
        service.createCheckoutSession("tenant-1", "pro")
      ).rejects.toThrow("Stripe price ID not configured");

      process.env.STRIPE_PRO_PRICE_ID = origVal;
    });
  });

  describe("changePlan", () => {
    const activeSubscription = {
      id: "sub-1",
      tenantId: "tenant-1",
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_stripe_123",
      stripePriceId: "price_starter_test",
      status: "active",
      plan: "starter",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(),
      trialStart: null,
      trialEnd: null,
      cancelAtPeriodEnd: false,
      canceledAt: null,
      gracePeriodEnd: null,
      deleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("should upgrade from starter to pro", async () => {
      mockRepo.getByTenantId.mockResolvedValue(activeSubscription);
      mockStripeService.updateSubscriptionPrice.mockResolvedValue({
        id: "sub_stripe_123",
        status: "active",
        customerId: "cus_123",
        priceId: "price_pro_test",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        trialStart: null,
        trialEnd: null,
        cancelAtPeriodEnd: false,
        canceledAt: null,
      });

      await service.changePlan("tenant-1", "pro");

      expect(
        mockStripeService.updateSubscriptionPrice
      ).toHaveBeenCalledWith({
        subscriptionId: "sub_stripe_123",
        currentPriceId: "price_starter_test",
        newPriceId: "price_pro_test",
      });
      expect(mockRepo.update).toHaveBeenCalledWith(
        "sub-1",
        expect.objectContaining({
          plan: "pro",
          stripePriceId: "price_pro_test",
        })
      );
      expect(
        mockRepo.updateTenantSubscriptionStatus
      ).toHaveBeenCalledWith("tenant-1", "pro", "active");
    });

    it("should throw when no active subscription exists", async () => {
      mockRepo.getByTenantId.mockResolvedValue(null);

      await expect(
        service.changePlan("tenant-1", "pro")
      ).rejects.toThrow("No active subscription found");
    });

    it("should throw when subscription is canceled", async () => {
      mockRepo.getByTenantId.mockResolvedValue({
        ...activeSubscription,
        status: "canceled",
      });

      await expect(
        service.changePlan("tenant-1", "pro")
      ).rejects.toThrow("Subscription is not active");
    });

    it("should throw when trying to change to same plan", async () => {
      mockRepo.getByTenantId.mockResolvedValue(activeSubscription);

      await expect(
        service.changePlan("tenant-1", "starter")
      ).rejects.toThrow("Already on this plan");
    });

    it("should throw when Stripe update fails", async () => {
      mockRepo.getByTenantId.mockResolvedValue(activeSubscription);
      mockStripeService.updateSubscriptionPrice.mockResolvedValue(null);

      await expect(
        service.changePlan("tenant-1", "pro")
      ).rejects.toThrow("Failed to update subscription in Stripe");
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run --testPathPattern="subscription.service.test"`
Expected: FAIL — `createCheckoutSession` doesn't accept planCode parameter yet

- [ ] **Step 3: Update SubscriptionService implementation**

In `src/services/subscription/subscription.service.ts`:

**Replace the imports at the top** (lines 1-15) with:

```typescript
import { stripeService } from "@/services/stripe/stripe.service";
import {
  subscriptionRepository,
  type UpdateSubscriptionInput,
} from "@/repositories/subscription.repository";
import {
  getStripePriceId,
  getPlanByCode,
  getPlanByStripePriceId,
} from "./subscription.plans";
import type {
  SubscriptionInfo,
  SubscriptionStatus,
  SubscriptionPlan,
  CheckoutSessionOptions,
  StripeSubscriptionData,
  StripeInvoiceData,
  StripeCheckoutSessionData,
  DashboardSubscriptionInfo,
} from "./subscription.types";
```

**Remove** the `STRIPE_STANDARD_PRICE_ID` constant (line 17).

**Update `createCheckoutSession`** — replace the entire method (lines 103-132) with:

```typescript
  async createCheckoutSession(
    tenantId: string,
    planCode: string,
    options?: Partial<CheckoutSessionOptions>
  ): Promise<{ url: string; sessionId: string }> {
    const plan = getPlanByCode(planCode);
    if (!plan) {
      throw new Error("Invalid plan code: " + planCode);
    }

    const stripePriceId = getStripePriceId(planCode);
    if (!stripePriceId) {
      throw new Error("Stripe price ID not configured for plan: " + planCode);
    }

    // Get or create Stripe customer for this tenant
    const stripeCustomerId = await this.getOrCreateStripeCustomer(tenantId);

    const successUrl =
      options?.successUrl ?? `${APP_URL}/dashboard/subscription?success=true`;
    const cancelUrl =
      options?.cancelUrl ?? `${APP_URL}/dashboard/subscription?canceled=true`;

    const result = await stripeService.createSubscriptionCheckoutSession({
      customerId: stripeCustomerId,
      priceId: stripePriceId,
      tenantId,
      successUrl,
      cancelUrl,
      trialDays: STRIPE_TRIAL_DAYS,
    });

    return {
      url: result.url,
      sessionId: result.sessionId,
    };
  }
```

**Add `changePlan` method** after `resumeSubscription` (after line 198):

```typescript
  /**
   * Change subscription plan (upgrade or downgrade)
   */
  async changePlan(tenantId: string, newPlanCode: string): Promise<void> {
    const plan = getPlanByCode(newPlanCode);
    if (!plan) {
      throw new Error("Invalid plan code: " + newPlanCode);
    }

    const newStripePriceId = getStripePriceId(newPlanCode);
    if (!newStripePriceId) {
      throw new Error(
        "Stripe price ID not configured for plan: " + newPlanCode
      );
    }

    const subscription = await subscriptionRepository.getByTenantId(tenantId);
    if (!subscription || !subscription.stripeSubscriptionId) {
      throw new Error("No active subscription found");
    }

    if (
      subscription.status !== "active" &&
      subscription.status !== "trialing"
    ) {
      throw new Error("Subscription is not active");
    }

    if (subscription.plan === newPlanCode) {
      throw new Error("Already on this plan");
    }

    if (!subscription.stripePriceId) {
      throw new Error("Current subscription has no price ID");
    }

    const updated = await stripeService.updateSubscriptionPrice({
      subscriptionId: subscription.stripeSubscriptionId,
      currentPriceId: subscription.stripePriceId,
      newPriceId: newStripePriceId,
    });

    if (!updated) {
      throw new Error("Failed to update subscription in Stripe");
    }

    // Update local records
    await subscriptionRepository.update(subscription.id, {
      plan: newPlanCode,
      stripePriceId: newStripePriceId,
    });

    await this.updateTenantSubscriptionStatus(
      tenantId,
      newPlanCode,
      subscription.status
    );
  }
```

**Update `handleCheckoutSessionCompleted`** — replace the hardcoded `"standard"` plan detection. In line 266 and 269, replace:

```typescript
    await this.updateTenantSubscriptionStatus(
      tenantId,
      "standard",
      stripeSubscription.status
    );
```

With:

```typescript
    // Detect plan from Stripe price ID
    const detectedPlan = stripeSubscription.priceId
      ? getPlanByStripePriceId(stripeSubscription.priceId)
      : undefined;
    const planCode = detectedPlan?.code ?? "starter";

    await this.updateTenantSubscriptionStatus(
      tenantId,
      planCode,
      stripeSubscription.status
    );
```

Also update the `create` call in the same method to include the detected plan:

In the `else` block (around line 251), add `plan: planCode` to the create call:

```typescript
      await subscriptionRepository.create(tenantId, {
        stripeCustomerId: session.customer,
        stripeSubscriptionId: stripeSubscription.id,
        stripePriceId: stripeSubscription.priceId ?? undefined,
        plan: planCode,
        status: stripeSubscription.status as SubscriptionStatus,
        currentPeriodStart: stripeSubscription.currentPeriodStart,
        currentPeriodEnd: stripeSubscription.currentPeriodEnd,
        trialStart: stripeSubscription.trialStart ?? undefined,
        trialEnd: stripeSubscription.trialEnd ?? undefined,
      });
```

**Update `handleSubscriptionCreated`** — replace the `"standard"` in line 316-320:

```typescript
    const planFromPrice = priceId
      ? getPlanByStripePriceId(priceId)
      : undefined;
    const planCode = planFromPrice?.code ?? "starter";

    await subscriptionRepository.create(tenantId, {
      stripeCustomerId: subscription.customer,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId ?? undefined,
      plan: planCode,
      status: subscription.status as SubscriptionStatus,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      trialStart: subscription.trial_start
        ? new Date(subscription.trial_start * 1000)
        : undefined,
      trialEnd: subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : undefined,
    });

    await this.updateTenantSubscriptionStatus(
      tenantId,
      planCode,
      subscription.status
    );
```

**Update `handleSubscriptionUpdated`** — add plan detection from price change. After the `updateData` construction (around line 365), add plan detection:

```typescript
    // Detect plan change from price ID
    if (priceId) {
      const detectedPlan = getPlanByStripePriceId(priceId);
      if (detectedPlan) {
        updateData.plan = detectedPlan.code;
      }
    }
```

And update the `updateTenantSubscriptionStatus` call (around line 370) to use the detected plan:

```typescript
    const currentPlan = priceId
      ? (getPlanByStripePriceId(priceId)?.code ?? existingSubscription.plan)
      : existingSubscription.plan;

    await this.updateTenantSubscriptionStatus(
      existingSubscription.tenantId,
      currentPlan,
      subscription.status
    );
```

**Update `handleSubscriptionDeleted`** — the `"free"` value in line 404 is correct, keep it as is.

**Update `handleInvoicePaymentSucceeded`** — replace `"standard"` in line 441:

```typescript
    await this.updateTenantSubscriptionStatus(
      subscription.tenantId,
      subscription.plan,
      "active"
    );
```

**Update `handleInvoicePaymentFailed`** — replace `"standard"` in lines 479-482:

```typescript
    await this.updateTenantSubscriptionStatus(
      subscription.tenantId,
      subscription.plan,
      "past_due"
    );
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run --testPathPattern="subscription.service.test"`
Expected: All tests PASS

- [ ] **Step 5: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/services/subscription/subscription.service.ts src/services/subscription/__tests__/subscription.service.test.ts
git commit -m "feat: update SubscriptionService for multi-plan checkout and changePlan (#13)"
```

---

## Task 5: Update Repository Default and Environment

**Files:**
- Modify: `src/repositories/subscription.repository.ts`
- Modify: `.env.example`

- [ ] **Step 1: Update repository default plan**

In `src/repositories/subscription.repository.ts` line 89, change:

```typescript
      plan: data.plan ?? "standard",
```

To:

```typescript
      plan: data.plan ?? "starter",
```

- [ ] **Step 2: Update .env.example**

In `.env.example`, replace:

```
# Stripe Subscription
# Create a product and price in Stripe Dashboard
# https://dashboard.stripe.com/test/products
STRIPE_STANDARD_PRICE_ID=price_xxx
STRIPE_TRIAL_DAYS=14
STRIPE_GRACE_PERIOD_DAYS=7
```

With:

```
# Stripe Subscription Plans
# Create products and prices in Stripe Dashboard for each plan tier
# https://dashboard.stripe.com/test/products
STRIPE_STARTER_PRICE_ID=price_xxx
STRIPE_PRO_PRICE_ID=price_xxx
STRIPE_ENTERPRISE_PRICE_ID=price_xxx
STRIPE_TRIAL_DAYS=14
STRIPE_GRACE_PERIOD_DAYS=7
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/repositories/subscription.repository.ts .env.example
git commit -m "feat: update repository default plan and env config (#13)"
```

---

## Task 6: API Routes

**Files:**
- Create: `src/app/api/dashboard/subscription/plans/route.ts`
- Modify: `src/app/api/dashboard/subscription/checkout/route.ts`
- Create: `src/app/api/dashboard/subscription/change-plan/route.ts`

- [ ] **Step 1: Create plans endpoint**

Create `src/app/api/dashboard/subscription/plans/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getAllPlans } from "@/services/subscription";

// GET: List available subscription plans
export async function GET() {
  const plans = getAllPlans();

  return NextResponse.json({
    success: true,
    data: plans.map((plan) => ({
      code: plan.code,
      name: plan.name,
      monthlyPrice: plan.monthlyPrice,
      currency: plan.currency,
      features: plan.features,
    })),
  });
}
```

- [ ] **Step 2: Update checkout route to accept planCode**

Replace the entire contents of `src/app/api/dashboard/subscription/checkout/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { subscriptionService } from "@/services/subscription";

// POST: Create checkout session for subscription
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
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
      planCode,
      { successUrl, cancelUrl }
    );

    return NextResponse.json({
      success: true,
      data: {
        url: result.url,
        sessionId: result.sessionId,
      },
    });
  } catch (error) {
    console.error("[Dashboard Subscription Checkout] Error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to create checkout session";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Create change-plan endpoint**

Create `src/app/api/dashboard/subscription/change-plan/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { subscriptionService } from "@/services/subscription";

// POST: Change subscription plan (upgrade/downgrade)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { planCode } = body as { planCode?: string };

    if (!planCode) {
      return NextResponse.json(
        { success: false, error: "planCode is required" },
        { status: 400 }
      );
    }

    await subscriptionService.changePlan(session.user.tenantId, planCode);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Dashboard Subscription Change Plan] Error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to change plan";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/app/api/dashboard/subscription/plans/route.ts src/app/api/dashboard/subscription/checkout/route.ts src/app/api/dashboard/subscription/change-plan/route.ts
git commit -m "feat: add plan list and change-plan API routes (#13)"
```

---

## Task 7: PricingCard Component

**Files:**
- Create: `src/components/dashboard/subscription/PricingCard.tsx`
- Modify: `src/components/dashboard/subscription/index.ts`

- [ ] **Step 1: Create PricingCard component**

Create `src/components/dashboard/subscription/PricingCard.tsx`:

```tsx
"use client";

import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PricingCardProps {
  name: string;
  monthlyPrice: number;
  currency: string;
  features: string[];
  isCurrentPlan: boolean;
  isRecommended?: boolean;
  actionLabel: string;
  onAction: () => void;
  isLoading: boolean;
}

export function PricingCard({
  name,
  monthlyPrice,
  currency,
  features,
  isCurrentPlan,
  isRecommended,
  actionLabel,
  onAction,
  isLoading,
}: PricingCardProps) {
  return (
    <div
      className={`relative rounded-lg border-2 bg-white p-6 shadow-sm ${
        isCurrentPlan
          ? "border-theme-primary"
          : isRecommended
            ? "border-theme-primary-hover"
            : "border-gray-200"
      }`}
    >
      {isCurrentPlan && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-theme-primary px-3 py-1 text-xs font-medium text-theme-primary-foreground">
            Current Plan
          </span>
        </div>
      )}
      {!isCurrentPlan && isRecommended && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-theme-primary-hover px-3 py-1 text-xs font-medium text-theme-primary-foreground">
            Recommended
          </span>
        </div>
      )}

      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900">{name}</h3>
        <div className="mt-4">
          <span className="text-4xl font-bold text-gray-900">
            ${monthlyPrice}
          </span>
          <span className="text-sm text-gray-500">
            /{currency === "USD" ? "mo" : "mo"}
          </span>
        </div>
      </div>

      <ul className="mt-6 space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-start">
            <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
            <span className="ml-2 text-sm text-gray-700">{feature}</span>
          </li>
        ))}
      </ul>

      <div className="mt-8">
        <Button
          className="w-full"
          variant={isCurrentPlan ? "outline" : "default"}
          onClick={onAction}
          disabled={isCurrentPlan || isLoading}
        >
          {isCurrentPlan ? "Current Plan" : isLoading ? "Loading..." : actionLabel}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update index.ts**

In `src/components/dashboard/subscription/index.ts`, add:

```typescript
export { PricingCard } from "./PricingCard";
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/subscription/PricingCard.tsx src/components/dashboard/subscription/index.ts
git commit -m "feat: add PricingCard component for plan display (#13)"
```

---

## Task 8: Update SubscriptionClient Page

**Files:**
- Modify: `src/components/dashboard/subscription/SubscriptionClient.tsx`

- [ ] **Step 1: Rewrite SubscriptionClient with pricing cards**

Replace the entire contents of `src/components/dashboard/subscription/SubscriptionClient.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CreditCard, CheckCircle, AlertTriangle, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SubscriptionInfo } from "@/services/subscription";
import { SubscriptionStatusBadge } from "./SubscriptionStatusBadge";
import { PricingCard } from "./PricingCard";

interface PlanInfo {
  code: string;
  name: string;
  monthlyPrice: number;
  currency: string;
  features: string[];
}

interface SubscriptionClientProps {
  subscription: SubscriptionInfo | null;
}

const PLAN_TIER: Record<string, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  enterprise: 3,
};

export function SubscriptionClient({ subscription }: SubscriptionClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<PlanInfo[]>([]);

  const success = searchParams.get("success") === "true";
  const canceled = searchParams.get("canceled") === "true";

  useEffect(() => {
    fetch("/api/dashboard/subscription/plans")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setPlans(data.data);
        }
      })
      .catch(() => {
        // Plans will remain empty; cards won't render
      });
  }, []);

  const isSubscribed =
    subscription &&
    subscription.status !== "canceled" &&
    subscription.status !== "incomplete";

  const handleSubscribe = async (planCode: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/dashboard/subscription/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to create checkout session");
      }

      window.location.href = data.data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsLoading(false);
    }
  };

  const handleChangePlan = async (planCode: string) => {
    const currentTier = PLAN_TIER[subscription?.plan ?? "free"] ?? 0;
    const newTier = PLAN_TIER[planCode] ?? 0;
    const action = newTier > currentTier ? "upgrade" : "downgrade";

    if (
      !confirm(
        `Are you sure you want to ${action} to the ${planCode.charAt(0).toUpperCase() + planCode.slice(1)} plan? Your billing will be adjusted with proration.`
      )
    ) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/dashboard/subscription/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to change plan");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/dashboard/subscription/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to open billing portal");
      }

      window.location.href = data.data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsLoading(false);
    }
  };

  const handleCancel = async () => {
    if (
      !confirm(
        "Are you sure you want to cancel your subscription? You will still have access until the end of your billing period."
      )
    ) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/dashboard/subscription/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancelImmediately: false }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to cancel subscription");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResume = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/dashboard/subscription/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to resume subscription");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getActionLabel = (planCode: string): string => {
    if (!isSubscribed) return "Start Free Trial";
    const currentTier = PLAN_TIER[subscription?.plan ?? "free"] ?? 0;
    const planTier = PLAN_TIER[planCode] ?? 0;
    if (planTier > currentTier) return "Upgrade";
    if (planTier < currentTier) return "Downgrade";
    return "Current Plan";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Subscription</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your subscription and billing
        </p>
      </div>

      {/* Success/Canceled Messages */}
      {success && (
        <div className="rounded-md bg-green-50 p-4">
          <div className="flex">
            <CheckCircle className="h-5 w-5 text-green-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">
                Subscription activated successfully!
              </p>
            </div>
          </div>
        </div>
      )}

      {canceled && (
        <div className="rounded-md bg-yellow-50 p-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-yellow-800">
                Checkout was canceled. You can try again anytime.
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <XCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Trial Banner */}
      {subscription?.status === "trialing" &&
        subscription.trialDaysRemaining !== null && (
          <div className="rounded-md bg-blue-50 p-4">
            <div className="flex">
              <Clock className="h-5 w-5 text-blue-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  Free Trial Active
                </h3>
                <p className="mt-1 text-sm text-blue-700">
                  You have {subscription.trialDaysRemaining} days remaining in
                  your free trial.
                  {subscription.trialEnd && (
                    <>
                      {" "}
                      Your trial ends on {formatDate(subscription.trialEnd)}.
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

      {/* Past Due Banner */}
      {subscription?.status === "past_due" && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Payment Failed
              </h3>
              <p className="mt-1 text-sm text-red-700">
                Your last payment failed. Please update your payment method to
                continue using premium features.
                {subscription.gracePeriodEnd && (
                  <>
                    {" "}
                    You have until {formatDate(subscription.gracePeriodEnd)} to
                    update your payment.
                  </>
                )}
              </p>
              <div className="mt-3">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleManageBilling}
                  disabled={isLoading}
                >
                  Update Payment Method
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Banner */}
      {subscription?.cancelAtPeriodEnd &&
        subscription.status !== "canceled" && (
          <div className="rounded-md bg-yellow-50 p-4">
            <div className="flex">
              <AlertTriangle className="h-5 w-5 text-yellow-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Subscription Ending
                </h3>
                <p className="mt-1 text-sm text-yellow-700">
                  Your subscription is set to cancel at the end of your billing
                  period
                  {subscription.currentPeriodEnd && (
                    <> on {formatDate(subscription.currentPeriodEnd)}</>
                  )}
                  .
                </p>
                <div className="mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResume}
                    disabled={isLoading}
                  >
                    Resume Subscription
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* Current Subscription Info (when subscribed) */}
      {isSubscribed && (
        <div className="rounded-lg bg-white shadow">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center">
                <CreditCard className="h-8 w-8 text-gray-400" />
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    {subscription.plan.charAt(0).toUpperCase() +
                      subscription.plan.slice(1)}{" "}
                    Plan
                  </h3>
                  <div className="mt-1 flex items-center gap-2">
                    <SubscriptionStatusBadge status={subscription.status} />
                    {subscription.cancelAtPeriodEnd && (
                      <span className="text-xs text-yellow-600">
                        (Cancels at period end)
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleManageBilling}
                  disabled={isLoading}
                >
                  Manage Billing
                </Button>
                {!subscription.cancelAtPeriodEnd &&
                  subscription.status !== "past_due" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCancel}
                      disabled={isLoading}
                    >
                      Cancel
                    </Button>
                  )}
              </div>
            </div>

            {(subscription.status === "active" ||
              subscription.status === "trialing") && (
              <div className="mt-6 border-t border-gray-200 pt-6">
                <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      Current Period
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {formatDate(subscription.currentPeriodStart)} -{" "}
                      {formatDate(subscription.currentPeriodEnd)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      Next Billing Date
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {subscription.cancelAtPeriodEnd
                        ? "No future billing"
                        : formatDate(subscription.currentPeriodEnd)}
                    </dd>
                  </div>
                </dl>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pricing Cards */}
      {plans.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            {isSubscribed ? "Change Plan" : "Choose a Plan"}
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {plans.map((plan) => (
              <PricingCard
                key={plan.code}
                name={plan.name}
                monthlyPrice={plan.monthlyPrice}
                currency={plan.currency}
                features={plan.features}
                isCurrentPlan={subscription?.plan === plan.code}
                isRecommended={plan.code === "pro"}
                actionLabel={getActionLabel(plan.code)}
                onAction={() =>
                  isSubscribed
                    ? handleChangePlan(plan.code)
                    : handleSubscribe(plan.code)
                }
                isLoading={isLoading}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/subscription/SubscriptionClient.tsx
git commit -m "feat: update SubscriptionClient with pricing cards and plan switching (#13)"
```

---

## Task 9: Data Migration and Final Verification

**Files:**
- No new files — runtime migration via prisma

- [ ] **Step 1: Run all tests**

Run: `npm test -- --run`
Expected: All tests PASS

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 3: Verify full build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit any remaining fixes**

If any test or lint fixes were needed, commit them:

```bash
git add -A
git commit -m "fix: resolve test and lint issues for multi-plan subscription (#13)"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Plan definitions and helpers | `subscription.plans.ts` + test |
| 2 | Update types | `subscription.types.ts`, `index.ts` |
| 3 | StripeService.updateSubscriptionPrice | `stripe.types.ts`, `stripe.service.ts` |
| 4 | Update SubscriptionService | `subscription.service.ts` + test |
| 5 | Repository default + env config | `subscription.repository.ts`, `.env.example` |
| 6 | API routes | plans, checkout, change-plan routes |
| 7 | PricingCard component | `PricingCard.tsx` |
| 8 | SubscriptionClient update | `SubscriptionClient.tsx` |
| 9 | Final verification | Tests, lint, build |
