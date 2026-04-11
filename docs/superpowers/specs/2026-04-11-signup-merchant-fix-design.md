# Fix: Direct Stytch Signup Should Create Default Merchant + Login/Onboarding Integration Tests

**Date**: 2026-04-11
**Status**: Draft
**Branch**: `fix/signup-creates-merchant`

## Background

Local user `maqh1988` logs into the dashboard and the home page renders **"No Store Found"** instead of the onboarding flow. The intended post-refactor behavior is that any newly authenticated tenant lands on the onboarding flow (which already handles a fresh tenant with no menu, no website data, etc.).

Project context: there is no integration test today that exercises either signup path end-to-end, which is why this regression slipped in.

## Root Cause

There are two ways a Tenant + User come into existence in this codebase:

| Flow | Entry point | Creates Tenant? | Creates Merchant? | Creates User? |
|------|-------------|-----------------|-------------------|---------------|
| `/generator` → claim | `generator.service.ts buildTenant()` then `POST /api/auth/claim` | ✅ `generator.service.ts:82` | ✅ `generator.service.ts:94` | ✅ `claim/route.ts:45` |
| Direct Stytch login (new email) | `auth.service.ts findOrCreateStytchUser()` | ✅ `auth.service.ts:48` | ❌ **missing** | ✅ `auth.service.ts:56` |

PR #75 (`fix: create default merchant on registration + onboarding website API`, merged 2026-04-10) had introduced `companyService.createTenantWithCompanyAndMerchant` and made `findOrCreateStytchUser` call it, so the direct-signup flow created a default merchant.

Commit `e61be27 refactor: remove companyId from auth flow, create Tenant directly` (also 2026-04-10) inlined tenant creation back into `auth.service.ts` and **dropped the merchant creation step**. `companyService` was deleted shortly after (`874e8f8`), so the helper no longer exists anywhere.

The dashboard page (`src/app/(dashboard)/dashboard/(protected)/page.tsx:23-36`) then surfaces the resulting "no merchant" state as a "No Store Found" warning instead of the onboarding flow.

## Goals

1. Restore the invariant: **every Tenant has at least one Merchant from the moment it is created**, regardless of the entry point.
2. Add integration test coverage that locks this invariant in for both signup flows + the dashboard render branch, so a future refactor cannot regress it silently.
3. Repair the existing local data for `maqh1988` (and any other tenant in the same broken state).

## Non-Goals

- Removing `AgentChatClient` from the dashboard page. The user has confirmed this stays in this PR; any cleanup is a separate concern.
- Reworking the onboarding step model, content, or UX.
- Adding E2E (browser) tests. Out of scope for this fix.
- Touching the `/generator` flow's UX or `claim` route shape.

## Design

### 1. New shared helper: `tenantService.createTenantWithMerchant`

Centralize "create a tenant with its default merchant" in `tenant.service.ts` so both `auth.service.ts` and `generator.service.ts` go through one path.

```ts
// src/services/tenant/tenant.service.ts
async createTenantWithMerchant(input: {
  name: string;
  source?: "generator" | "signup";
  // Optional merchant overrides for the generator flow
  merchant?: {
    name?: string;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
    phone?: string | null;
    businessHours?: unknown;
  };
  // Optional tenant overrides for the generator flow
  websiteUrl?: string | null;
  settings?: unknown;
  subscriptionStatus?: "trial" | "active" | "past_due" | "canceled";
  // Allow caller to extend the same transaction (for auth, which also creates a User)
  tx?: Prisma.TransactionClient;
}): Promise<{ tenant: Tenant; merchant: Merchant }>
```

Behavior:
- Generates a unique tenant slug from `name` via `generateUniqueSlug` against `tenantRepository.getBySlug`.
- Generates a unique merchant slug the same way against `merchantRepository.isSlugAvailable`.
- Creates Tenant first, then Merchant inside the same transaction.
- Defaults: merchant `name` = tenant `name`, merchant `status` = `pending`, all address fields nullable.
- If `tx` is passed in, uses it directly (no nested transaction). If not, opens its own `prisma.$transaction`.

### 2. Fix `auth.service.ts findOrCreateStytchUser`

Replace the inlined tenant creation block (lines 33–68) with a call to the new helper, all inside one transaction so the User is also created atomically:

```ts
const result = await prisma.$transaction(async (tx) => {
  const { tenant, merchant } = await tenantService.createTenantWithMerchant({
    name: companyName,
    source: "signup",
    tx,
  });
  const user = await tx.user.create({
    data: {
      id: generateEntityId(),
      tenantId: tenant.id,
      email,
      stytchUserId,
      name: emailPrefix,
      role: "owner",
      status: "active",
      lastLoginAt: new Date(),
    },
  });
  return { user, tenant, merchant };
});
return { user: result.user, isNewUser: true };
```

### 3. Refactor `generator.service.ts buildTenant`

Replace lines 60–102 with a single call to `tenantService.createTenantWithMerchant`, passing through the Google Places fields (`websiteUrl`, address fields, settings, `subscriptionStatus: "trial"`, `source: "generator"`). This eliminates the duplicated slug-generation + tenant/merchant insert logic.

`merchantId` is read from the returned merchant; the existing `markCompleted(generationId, tenantId, slug)` call stays the same.

### 4. Clean up `dashboard/(protected)/page.tsx`

Once the invariant holds, the `if (!merchantId)` branch (lines 23–36) is unreachable. Remove it. The page becomes:

```ts
const tenant = await tenantService.getTenantWithMerchants(tenantId);
if (!tenant || !tenant.merchants?.[0]) redirect("/dashboard/login");
const merchantId = tenant.merchants[0].id;
const menuCount = await menuService.countMenus(tenantId);
// ... rest unchanged: showOnboarding + AgentChatClient
```

The `redirect` covers the truly broken edge case (DB tampering, partial deletion); we don't render a user-facing "No Store Found" because no normal flow can produce that state any more.

`AgentChatClient` stays.

### 5. Backfill script for existing broken data

Add `scripts/backfill-missing-merchants.ts`:
- Find all tenants where no merchant exists (`prisma.tenant.findMany({ where: { merchants: { none: {} } } })`).
- For each, create a single default merchant via `merchantRepository.create(tenant.id, { slug, name: tenant.name, ... })`, where `slug` is generated through `generateUniqueSlug` against `merchantRepository.isSlugAvailable`. Status `pending`, address fields null.
- Log each fix.
- Idempotent: re-running the script after success does nothing because the `merchants: { none: {} }` filter no longer matches.

This will fix `maqh1988` and any other tenant in the same broken state. Run once locally; not part of CI.

## Integration Test Plan

Two layers (Plan D from brainstorming).

### Layer A — Service-level integration tests (real DB via Prisma)

**File**: `__tests__/services/auth/auth.service.stytch.integration.test.ts` (extend existing)

New test cases:
- `creates new user, tenant, AND default merchant when email not found`
  - Asserts `merchant` row exists with `tenantId` matching, `status: "pending"`, slug derived from tenant name
- `existing user (matched by email) does not create extra merchant`
- `existing user (matched by stytchUserId) does not create extra merchant`
- `transaction rollback: if user.create fails, no orphan tenant or merchant remain` — simulate by passing a duplicate `stytchUserId` or by mocking a failure point

**File** (new): `__tests__/services/tenant/tenant.service.create-with-merchant.integration.test.ts`
- Creates tenant + merchant atomically
- Slug collision: when base slug taken, falls back via `generateUniqueSlug`
- Merchant defaults: status `pending`, name = tenant name when no override

### Layer B — Page / Route integration tests

**File** (new): `__tests__/app/dashboard/protected/page.integration.test.tsx`
- Seeds tenant + merchant + user in the real DB; mocks `auth()` to return that session
- Calls the page's default-exported async Server Component as a function (`await Page()`), then uses React Testing Library's `render` on the returned element. This is the pattern used elsewhere in the repo for async server components — verify against an existing test before writing the first one and adapt if the actual pattern differs.
- Asserts: no `"No Store Found"` text in output, `OnboardingSection`-related markup present (e.g. step titles or a stable `data-testid`)
- Negative path: tenant exists with `onboardingStatus: "completed"` → onboarding section absent, agent UI present
- Regression guard for the original bug: a freshly-created tenant (via `tenantService.createTenantWithMerchant`) renders the onboarding flow on its dashboard page

**File** (new): `__tests__/app/api/auth/claim/route.integration.test.ts`
- Seed tenant + merchant via direct prisma calls (simulating generator output), `subscriptionStatus: "trial"`
- POST `/api/auth/claim` with valid payload → 200, user created on tenant, tenant `subscriptionStatus: "active"`, **the seeded merchant is still present** (regression guard)
- Error cases: tenant not found → 404; tenant not in trial → 400; duplicate email → 409

### What we explicitly do NOT test

- The Stytch SDK callback at `/api/auth/stytch/callback` already has unit tests (`src/app/api/auth/stytch/callback/__tests__/route.test.ts`) that mock `authService.findOrCreateStytchUser`. We don't duplicate them with integration-level tests — the new service-level integration tests + the page test cover the gap.
- E2E browser flows.

## Testing & Verification

```bash
npm run test:run -- auth.service.stytch
npm run test:run -- tenant.service
npm run test:run -- dashboard/protected
npm run test:run -- claim
```

All four new/extended files must pass against a real local DB (consistent with how `auth.service.stytch.integration.test.ts` already runs today).

Manual verification:
1. Run backfill script: `npx tsx scripts/backfill-missing-merchants.ts`
2. Log in as `maqh1988` locally → dashboard shows OnboardingSection, not "No Store Found"
3. Create a brand-new email via Stytch login → same result
4. `/generator` → claim flow still works end-to-end

## Files Touched

**Modified:**
- `src/services/tenant/tenant.service.ts` — add `createTenantWithMerchant`
- `src/services/auth/auth.service.ts` — call new helper inside transaction
- `src/services/generator/generator.service.ts` — replace `buildTenant` body with helper call
- `src/app/(dashboard)/dashboard/(protected)/page.tsx` — remove "No Store Found" branch
- `__tests__/services/auth/auth.service.stytch.integration.test.ts` — add merchant assertions

**Added:**
- `__tests__/services/tenant/tenant.service.create-with-merchant.integration.test.ts`
- `__tests__/app/dashboard/protected/page.integration.test.tsx`
- `__tests__/app/api/auth/claim/route.integration.test.ts`
- `scripts/backfill-missing-merchants.ts`

## Risks

- **Generator flow regression**: refactoring `buildTenant` to use the shared helper changes the call shape. The existing generator unit tests (`src/services/generator/__tests__/generator.service.test.ts`) need to keep passing — if they mock individual repository calls, the test mocks will need to be updated.
- **Transaction nesting**: Prisma does not support nested `$transaction`. The helper accepts an optional `tx` to avoid this. Auth service must pass its outer `tx` in.
- **Slug uniqueness under concurrency**: two simultaneous signups with the same email prefix could both compute the same slug. `generateUniqueSlug` already handles this for generator; we get the same protection here.
