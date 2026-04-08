# Subscription Multi-Plan System Design

**Issue**: #13 — [subscription system]
**Date**: 2026-04-08
**Type**: Feature enhancement

## Overview

Enhance the existing subscription system to support multiple plan tiers (Starter / Pro / Enterprise) with upgrade/downgrade via Stripe proration. No new database tables needed — plans are defined as code constants with Stripe Price IDs configured via environment variables.

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Plan storage | Code constants (not DB) | Fixed tiers, no admin CRUD needed |
| Upgrade/downgrade | Stripe proration | Built-in Stripe support, automatic prorated billing |
| Invoice viewing | Stripe Billing Portal | Already integrated, no local invoice table needed |
| UI style | Pricing cards with comparison | Standard SaaS pattern, clear feature comparison |

## What Already Works (No Changes)

- Free trial (14 days, configurable)
- Grace period (7 days for past_due)
- Cancel at period end + resume
- Stripe Billing Portal (payment methods + invoices)
- Webhook handling (status sync)
- Tenant denormalized subscription fields
- Mock mode for development

## Design

### 1. Plan Configuration

New file: `src/services/subscription/subscription.plans.ts`

Plans defined as a typed constant object:

```typescript
export const PLAN_DEFINITIONS = {
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
} as const;
```

Helper functions:
- `getPlanByCode(code)` — look up plan definition
- `getPlanByStripePriceId(priceId)` — reverse lookup from Stripe Price ID to plan code
- `getStripePriceId(planCode)` — get the Stripe Price ID from env for a plan
- `getAllPlans()` — return all plan definitions for UI display

### 2. Type Changes

**`subscription.types.ts`**:
- `SubscriptionPlan` type: `"free" | "starter" | "pro" | "enterprise"` (was `"free" | "standard"`)
- `SUBSCRIPTION_PLANS` constant updated accordingly
- New request type: `ChangePlanRequest { planCode: string }`
- `CreateCheckoutSessionRequest` gains `planCode: string` field

### 3. Data Model Changes

**Prisma `Subscription` model** — no schema changes needed. The `plan` field is already a `String`, just the runtime values change. The `stripePriceId` field already exists for tracking the current Stripe Price.

**Tenant table** — `subscriptionPlan` denormalized field already exists as `String`, values just expand.

**Migration note**: Existing `"standard"` plan values should be migrated to `"starter"` (or whichever tier maps to the old standard plan). A data migration script handles this.

### 4. Service Layer Changes

#### SubscriptionService (`subscription.service.ts`)

**Modified methods**:
- `createCheckoutSession(tenantId, planCode)` — accepts planCode instead of using hardcoded STRIPE_STANDARD_PRICE_ID. Looks up Stripe Price ID via `getStripePriceId(planCode)`.

**New methods**:
- `changePlan(tenantId, newPlanCode)` — upgrade/downgrade:
  1. Validate subscription is active/trialing
  2. Validate newPlanCode is different from current plan
  3. Look up new Stripe Price ID
  4. Call `stripeService.updateSubscriptionPrice()` with proration
  5. Update local `plan` and `stripePriceId` fields
  6. Update tenant denormalized status
- `getAvailablePlans()` — returns plan definitions for API/UI consumption

**Webhook handler changes**:
- `handleSubscriptionUpdated` — detect price changes, reverse-lookup planCode from the new Stripe Price ID, update local `plan` field accordingly
- `handleCheckoutSessionCompleted` — derive planCode from the subscription's price ID instead of hardcoding "standard"

#### StripeService (`stripe.service.ts`)

**New method**:
- `updateSubscriptionPrice(subscriptionId, oldPriceId, newPriceId)` — calls `stripe.subscriptions.update()` with:
  - Replace the existing subscription item's price
  - `proration_behavior: "create_prorations"` for immediate prorated billing
  - Returns the updated subscription info

**Modified method**:
- `createSubscriptionCheckoutSession` — no changes needed, already accepts `priceId` parameter

### 5. API Routes

| Method | Route | Change |
|--------|-------|--------|
| GET | `/api/dashboard/subscription/plans` | **New** — returns plan list with features and prices |
| POST | `/api/dashboard/subscription/checkout` | **Modified** — requires `planCode` in body |
| POST | `/api/dashboard/subscription/change-plan` | **New** — accepts `{ planCode }`, calls changePlan service |
| GET | `/api/dashboard/subscription` | No change |
| POST | `/api/dashboard/subscription/cancel` | No change |
| POST | `/api/dashboard/subscription/resume` | No change |
| POST | `/api/dashboard/subscription/portal` | No change |

### 6. Dashboard UI

**SubscriptionClient.tsx** restructured:

**No subscription / canceled state**:
- Render 3 pricing cards side by side (Starter / Pro / Enterprise)
- Each card shows: plan name, price, feature list, CTA button ("Start Free Trial")
- Pro card visually highlighted as recommended

**Active subscription state**:
- Top section: current plan info + status badge + billing cycle dates (unchanged)
- Below: 3 pricing cards with current plan marked "Current Plan" (disabled button)
- Other plans show "Upgrade" or "Downgrade" button based on tier comparison
- Click upgrade/downgrade → confirmation dialog → call change-plan API → refresh

**New component**: `PricingCard` — reusable card component for plan display:
- Props: plan definition, isCurrentPlan, actionLabel, onAction, isLoading
- Responsive: stack on mobile, side by side on desktop

**Existing banners unchanged**: trial, past_due, cancel-at-period-end banners remain as-is.

### 7. Environment Variables

```env
# Replace STRIPE_STANDARD_PRICE_ID with per-plan IDs
STRIPE_STARTER_PRICE_ID=price_xxx
STRIPE_PRO_PRICE_ID=price_xxx
STRIPE_ENTERPRISE_PRICE_ID=price_xxx

# These remain unchanged
STRIPE_TRIAL_DAYS=14
STRIPE_GRACE_PERIOD_DAYS=7
```

Remove: `STRIPE_STANDARD_PRICE_ID` (replaced by per-plan IDs).

### 8. Data Migration

A one-time script to update existing subscriptions:
- `plan: "standard"` → `plan: "starter"` in both `Subscription` and `Tenant` tables
- Run via `prisma db execute` or a migration script

### 9. Error Handling

All errors use existing patterns:
- Invalid planCode → throw error with message (service layer validation)
- Missing Stripe Price ID env var → throw at checkout/change-plan time
- Stripe API errors → propagate with logging (existing pattern)

### 10. Testing

Unit tests for:
- Plan lookup helpers (getPlanByCode, getPlanByStripePriceId)
- changePlan service method (mock Stripe calls)
- Webhook handler plan detection from price ID
- API route validation (invalid planCode, missing fields)

### Files Changed Summary

| File | Action |
|------|--------|
| `src/services/subscription/subscription.plans.ts` | New |
| `src/services/subscription/subscription.types.ts` | Modified |
| `src/services/subscription/subscription.service.ts` | Modified |
| `src/services/subscription/index.ts` | Modified (re-export) |
| `src/services/stripe/stripe.service.ts` | Modified |
| `src/services/stripe/stripe.types.ts` | Modified |
| `src/repositories/subscription.repository.ts` | No change needed |
| `src/app/api/dashboard/subscription/plans/route.ts` | New |
| `src/app/api/dashboard/subscription/checkout/route.ts` | Modified |
| `src/app/api/dashboard/subscription/change-plan/route.ts` | New |
| `src/components/dashboard/subscription/SubscriptionClient.tsx` | Modified |
| `src/components/dashboard/subscription/PricingCard.tsx` | New |
| `src/hooks/useSubscription.ts` | Modified (new plan types) |
| `.env.example` | Modified |
