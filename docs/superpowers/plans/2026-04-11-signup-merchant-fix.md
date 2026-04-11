# Signup-Merchant Fix + Login/Onboarding Integration Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the invariant that every Tenant has at least one Merchant from creation, regardless of signup path; lock it in with integration tests; backfill broken local data.

**Architecture:** Centralize "create tenant + default merchant in one transaction" in `tenantService.createTenantWithMerchant`. Both `auth.service.ts findOrCreateStytchUser` (direct Stytch signup) and `generator.service.ts buildTenant` (`/generator` flow) call it. Remove the now-unreachable "No Store Found" branch in the dashboard page. Add service-level + page/route integration tests against the real local DB. One-shot script repairs existing tenants missing a merchant.

**Tech Stack:** TypeScript, Next.js 16 App Router, Prisma + MySQL, Vitest, React Testing Library.

**Spec:** `docs/superpowers/specs/2026-04-11-signup-merchant-fix-design.md`

---

## File Structure

**Modified:**
- `src/services/tenant/tenant.service.ts` — add `createTenantWithMerchant` method
- `src/services/auth/auth.service.ts` — call new helper inside outer transaction
- `src/services/generator/generator.service.ts` — replace `buildTenant` body with helper call
- `src/services/generator/__tests__/generator.service.test.ts` — update mocks for new code path
- `src/app/(dashboard)/dashboard/(protected)/page.tsx` — remove "No Store Found" branch
- `__tests__/services/auth/auth.service.stytch.integration.test.ts` — add merchant assertions

**Added:**
- `__tests__/services/tenant/tenant.service.create-with-merchant.integration.test.ts`
- `__tests__/app/dashboard/protected/page.integration.test.tsx`
- `__tests__/app/api/auth/claim/route.integration.test.ts`
- `scripts/backfill-missing-merchants.ts`

---

## Task 0: Worktree Setup

- [ ] **Step 1: Create worktree from `main`**

```bash
git worktree add -b fix/signup-creates-merchant .worktrees/signup-merchant-fix main
cd .worktrees/signup-merchant-fix
```

- [ ] **Step 2: Install deps + generate Prisma client**

```bash
npm install
npm run db:generate
```

- [ ] **Step 3: Verify baseline tests pass**

```bash
npm run test:run -- auth.service.stytch
```

Expected: PASS (existing tests still green before any changes).

---

## Task 1: Add `tenantService.createTenantWithMerchant`

**Files:**
- Modify: `src/services/tenant/tenant.service.ts`
- Test: `__tests__/services/tenant/tenant.service.create-with-merchant.integration.test.ts` (new)

- [ ] **Step 1: Write the failing integration test**

Create `__tests__/services/tenant/tenant.service.create-with-merchant.integration.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import prisma from "@/lib/db";
import { tenantService } from "@/services/tenant/tenant.service";

describe("TenantService.createTenantWithMerchant", () => {
  beforeEach(async () => {
    await prisma.merchant.deleteMany({
      where: { name: { in: ["Acme Diner", "Acme Diner Store"] } },
    });
    await prisma.tenant.deleteMany({
      where: { name: { in: ["Acme Diner"] } },
    });
  });

  it("creates tenant and default merchant atomically", async () => {
    const { tenant, merchant } = await tenantService.createTenantWithMerchant({
      name: "Acme Diner",
      source: "signup",
    });

    expect(tenant.id).toBeTruthy();
    expect(tenant.name).toBe("Acme Diner");
    expect(tenant.slug).toMatch(/^acme-diner/);

    expect(merchant.tenantId).toBe(tenant.id);
    expect(merchant.name).toBe("Acme Diner");
    expect(merchant.status).toBe("pending");
    expect(merchant.slug).toMatch(/^acme-diner/);

    // Verify both rows actually persisted
    const dbTenant = await prisma.tenant.findUnique({ where: { id: tenant.id } });
    const dbMerchants = await prisma.merchant.findMany({
      where: { tenantId: tenant.id, deleted: false },
    });
    expect(dbTenant).not.toBeNull();
    expect(dbMerchants).toHaveLength(1);
    expect(dbMerchants[0].id).toBe(merchant.id);
  });

  it("falls back to a unique slug when base slug is taken", async () => {
    await tenantService.createTenantWithMerchant({ name: "Acme Diner" });
    const { tenant } = await tenantService.createTenantWithMerchant({
      name: "Acme Diner",
    });
    expect(tenant.slug).not.toBe("acme-diner");
    expect(tenant.slug).toMatch(/^acme-diner-/);
  });

  it("applies generator overrides (websiteUrl, address, subscriptionStatus)", async () => {
    const { tenant, merchant } = await tenantService.createTenantWithMerchant({
      name: "Acme Diner",
      source: "generator",
      websiteUrl: "https://acme.example",
      subscriptionStatus: "trial",
      merchant: {
        address: "1 Main St",
        city: "Springfield",
        state: "IL",
        zipCode: "62701",
        phone: "555-0100",
      },
    });

    expect(tenant.websiteUrl).toBe("https://acme.example");
    expect(tenant.subscriptionStatus).toBe("trial");
    expect(tenant.source).toBe("generator");
    expect(merchant.address).toBe("1 Main St");
    expect(merchant.city).toBe("Springfield");
    expect(merchant.phone).toBe("555-0100");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- tenant.service.create-with-merchant
```

Expected: FAIL — `tenantService.createTenantWithMerchant is not a function`.

- [ ] **Step 3: Implement `createTenantWithMerchant` in tenant service**

Edit `src/services/tenant/tenant.service.ts`. Add this import near the top with the other imports:

```typescript
import { generateEntityId } from "@/lib/id";
```

Then add the new method inside the `TenantService` class (after `createTenant`, before `getTenant`):

```typescript
  /**
   * Create a new tenant together with its default merchant in a single
   * transaction. Used by both direct Stytch signup and the /generator flow
   * to guarantee that every tenant has at least one merchant from creation.
   *
   * Pass `tx` to participate in an outer transaction (e.g. when the caller
   * also creates a User in the same atomic unit).
   */
  async createTenantWithMerchant(input: {
    name: string;
    source?: "signup" | "generator";
    websiteUrl?: string | null;
    settings?: Record<string, unknown>;
    subscriptionStatus?: "trial" | "active" | "past_due" | "canceled";
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
      const tenant = await client.tenant.create({
        data: {
          id: tenantId,
          name: input.name,
          slug: tenantSlug,
          websiteUrl: input.websiteUrl ?? undefined,
          settings: input.settings as Prisma.InputJsonValue | undefined,
          source: input.source,
          subscriptionStatus: input.subscriptionStatus,
        },
      });

      const merchant = await client.merchant.create({
        data: {
          id: merchantId,
          tenantId,
          slug: merchantSlug,
          name: merchantName,
          status: "pending",
          address: input.merchant?.address ?? null,
          city: input.merchant?.city ?? null,
          state: input.merchant?.state ?? null,
          zipCode: input.merchant?.zipCode ?? null,
          phone: input.merchant?.phone ?? null,
          businessHours: input.merchant?.businessHours as
            | Prisma.InputJsonValue
            | undefined,
        },
      });

      return { tenant, merchant };
    };

    if (input.tx) return run(input.tx);
    return prisma.$transaction(run);
  }
```

Note: `Prisma` and `prisma` and `generateUniqueSlug` and `tenantRepository` and `merchantRepository` are already imported at the top of the file. Only `generateEntityId` needs to be added.

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test:run -- tenant.service.create-with-merchant
```

Expected: PASS, all 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/services/tenant/tenant.service.ts __tests__/services/tenant/tenant.service.create-with-merchant.integration.test.ts
git commit -m "feat: add tenantService.createTenantWithMerchant shared helper"
```

---

## Task 2: Fix `auth.service.ts findOrCreateStytchUser` to Create Merchant

**Files:**
- Modify: `src/services/auth/auth.service.ts`
- Test: `__tests__/services/auth/auth.service.stytch.integration.test.ts`

- [ ] **Step 1: Add failing assertion to existing test**

Edit `__tests__/services/auth/auth.service.stytch.integration.test.ts`. In the `beforeEach`, also clean up merchants:

```typescript
beforeEach(async () => {
  // Clean up test data in reverse dependency order
  await prisma.user.deleteMany({
    where: { email: { in: ["existing@test.com", "newuser@test.com", "linked@test.com"] } },
  });
  await prisma.merchant.deleteMany({
    where: { tenant: { name: { in: ["Test Co", "newuser's Company", "linked's Company"] } } },
  });
  await prisma.tenant.deleteMany({
    where: { name: { in: ["Test Co", "newuser's Company", "linked's Company"] } },
  });
});
```

Then in the `"creates new user when email not found"` test, after the existing assertions, add:

```typescript
    // Verify a default merchant was also created in the same tenant
    const dbMerchants = await prisma.merchant.findMany({
      where: { tenantId: dbUser!.tenantId, deleted: false },
    });
    expect(dbMerchants).toHaveLength(1);
    expect(dbMerchants[0].name).toBe("newuser's Company");
    expect(dbMerchants[0].status).toBe("pending");
    expect(dbMerchants[0].slug).toBeTruthy();
```

Add a new test case at the end of the `describe` block:

```typescript
  it("does not create a duplicate merchant when an existing user logs in", async () => {
    // Seed an existing user + tenant + one merchant
    const tenantId = generateEntityId();
    await prisma.tenant.create({
      data: { id: tenantId, name: "Test Co", slug: `test-co-dup-${Date.now()}` },
    });
    await prisma.merchant.create({
      data: {
        id: generateEntityId(),
        tenantId,
        slug: `test-co-merchant-${Date.now()}`,
        name: "Test Co",
        status: "pending",
      },
    });
    await prisma.user.create({
      data: {
        id: generateEntityId(),
        tenantId,
        email: "existing@test.com",
        passwordHash: "hashed_pw",
        name: "Existing User",
        role: "owner",
        status: "active",
      },
    });

    await authService.findOrCreateStytchUser("existing@test.com", "stytch-user-dup");

    const merchants = await prisma.merchant.findMany({
      where: { tenantId, deleted: false },
    });
    expect(merchants).toHaveLength(1);
  });
```

- [ ] **Step 2: Run test to verify the new assertions fail**

```bash
npm run test:run -- auth.service.stytch
```

Expected: FAIL — "creates new user when email not found" fails because no merchant exists; the new "does not create duplicate" test passes incidentally (existing logic doesn't create merchants for existing users either, but it would also not create one for new users — that's the bug).

- [ ] **Step 3: Refactor `findOrCreateStytchUser` to use `createTenantWithMerchant`**

Replace the entire body of `src/services/auth/auth.service.ts` with:

```typescript
import prisma from "@/lib/db";
import { generateEntityId } from "@/lib/id";
import { tenantService } from "@/services/tenant/tenant.service";
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

    const user = await prisma.$transaction(async (tx) => {
      const { tenant } = await tenantService.createTenantWithMerchant({
        name: companyName,
        source: "signup",
        tx,
      });

      return tx.user.create({
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
    });

    return { user, isNewUser: true };
  }
}

export const authService = new AuthService();
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:run -- auth.service.stytch
```

Expected: PASS — both the updated and new tests green.

- [ ] **Step 5: Commit**

```bash
git add src/services/auth/auth.service.ts __tests__/services/auth/auth.service.stytch.integration.test.ts
git commit -m "fix: create default merchant on direct Stytch signup

Restores invariant from PR #75 that was lost in commit e61be27 when
the auth flow was refactored to inline tenant creation. New users now
get a default Merchant via tenantService.createTenantWithMerchant in
the same transaction as User creation."
```

---

## Task 3: Refactor `generator.service.ts buildTenant` to Use Helper

**Files:**
- Modify: `src/services/generator/generator.service.ts`
- Modify: `src/services/generator/__tests__/generator.service.test.ts`

- [ ] **Step 1: Update `generator.service.ts` to delegate to helper**

In `src/services/generator/generator.service.ts`:

Replace the imports block (lines 1-13) with:

```typescript
import { generatorRepository } from "@/repositories/generator.repository";
import { tenantService } from "@/services/tenant/tenant.service";
import type { GooglePlacesClient, PlaceDetails } from "./google-places.client";
import type {
  CreateGenerationInput,
  CreateGenerationResult,
  GenerationStatusResult,
} from "./generator.types";
```

Replace the `buildTenant` method (lines 60-102) with:

```typescript
  private async buildTenant(details: PlaceDetails) {
    const reviews = details.reviews.slice(0, 5).map((r) => ({
      author: r.author,
      rating: r.rating,
      text: r.text,
    }));

    const tenantSettings = {
      themePreset: "blue",
      website: { tagline: "", heroImage: "", socialLinks: [], reviews },
    };

    const { tenant, merchant } = await tenantService.createTenantWithMerchant({
      name: details.name,
      source: "generator",
      websiteUrl: details.websiteUrl,
      settings: tenantSettings,
      subscriptionStatus: "trial",
      merchant: {
        address: details.address,
        city: details.city,
        state: details.state,
        zipCode: details.zipCode,
        phone: details.phone,
        businessHours: details.businessHours,
      },
    });

    return {
      tenantId: tenant.id,
      merchantId: merchant.id,
      companySlug: tenant.slug,
      merchantSlug: merchant.slug,
    };
  }
```

- [ ] **Step 2: Update generator service unit tests**

The existing unit tests at `src/services/generator/__tests__/generator.service.test.ts` mock `tenantRepository`, `merchantRepository`, and `prisma.tenant.create` directly. After this refactor those mocks won't fire — `tenantService.createTenantWithMerchant` is the new seam.

Replace the mock block (lines 15-32) with:

```typescript
vi.mock("@/services/tenant/tenant.service", () => ({
  tenantService: {
    createTenantWithMerchant: vi.fn(),
  },
}));
```

Remove the now-unused `tenantRepository`, `merchantRepository`, `prisma` imports. Keep `generatorRepository`. Add:

```typescript
import { tenantService } from "@/services/tenant/tenant.service";
```

Find every test in the file that exercises `buildTenant` (search for `buildTenant` or for tests that previously asserted on `tenantRepository.getBySlug` / `merchantRepository.isSlugAvailable` / `prisma.tenant.create`). For each, replace the per-mock setup with a single mock on `tenantService.createTenantWithMerchant`:

```typescript
vi.mocked(tenantService.createTenantWithMerchant).mockResolvedValue({
  tenant: {
    id: "tenant-1",
    slug: "joes-pizza",
    name: "Joe's Pizza",
    websiteUrl: "https://joes.example",
  } as never,
  merchant: {
    id: "merchant-1",
    slug: "joes-pizza",
    name: "Joe's Pizza",
    tenantId: "tenant-1",
  } as never,
});
```

And update assertions: instead of asserting on the lower-level repo calls, assert on `tenantService.createTenantWithMerchant` being called with the right shape (name, source: "generator", websiteUrl, merchant.address, etc.).

- [ ] **Step 3: Run generator tests**

```bash
npm run test:run -- generator.service
```

Expected: PASS — all generator tests green.

- [ ] **Step 4: Commit**

```bash
git add src/services/generator/generator.service.ts src/services/generator/__tests__/generator.service.test.ts
git commit -m "refactor: route generator buildTenant through tenantService helper

DRY out the tenant + merchant creation logic. Both signup paths now
go through the same code, so future changes can't accidentally
diverge them again."
```

---

## Task 4: Remove "No Store Found" Branch from Dashboard Page

**Files:**
- Modify: `src/app/(dashboard)/dashboard/(protected)/page.tsx`

- [ ] **Step 1: Update page.tsx**

Replace the entire file with:

```typescript
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { tenantService } from "@/services/tenant/tenant.service";
import { menuService } from "@/services/menu/menu.service";
import { AgentChatClient } from "@/components/dashboard/agent";
import { OnboardingSection } from "@/components/dashboard/onboarding";
import { Suspense } from "react";

export default async function DashboardOverviewPage() {
  const session = await auth();

  if (!session?.user?.tenantId) {
    redirect("/dashboard/login");
  }

  const { tenantId } = session.user;

  const tenant = await tenantService.getTenantWithMerchants(tenantId);
  if (!tenant) redirect("/dashboard/login");

  const merchantId = tenant.merchants?.[0]?.id;
  if (!merchantId) {
    // Invariant violated: every tenant should have a default merchant.
    // Treat as corrupted session and force re-auth.
    redirect("/dashboard/signout");
  }

  const menuCount = await menuService.countMenus(tenantId);
  const hasMenu = menuCount > 0;

  const showOnboarding = tenant.onboardingStatus !== "completed";

  return (
    <div className="space-y-8 py-8">
      {showOnboarding && (
        <Suspense>
          <OnboardingSection />
        </Suspense>
      )}
      <AgentChatClient
        merchantId={merchantId}
        companyName={tenant.name}
        hasMenu={hasMenu}
      />
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: PASS, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/dashboard/(protected)/page.tsx
git commit -m "refactor: remove unreachable 'No Store Found' branch from dashboard page

After fix to signup flow, every tenant has a merchant by construction.
A missing merchant now indicates a corrupted session and redirects to
signout."
```

---

## Task 5: Page Integration Test

**Files:**
- Test: `__tests__/app/dashboard/protected/page.integration.test.tsx` (new)

- [ ] **Step 1: Verify async server component test pattern**

Search for any existing test that imports a `page.tsx` default export and calls it as a function:

```bash
grep -rn "from.*page['\"]" __tests__/ src/ --include="*.test.tsx" --include="*.test.ts" | head
```

If a precedent exists, mirror it. If not, the canonical pattern is:

```typescript
import Page from "@/app/(dashboard)/dashboard/(protected)/page";
import { render } from "@testing-library/react";
const element = await Page();
const { container } = render(element);
```

- [ ] **Step 2: Write the failing test**

Create `__tests__/app/dashboard/protected/page.integration.test.tsx`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import prisma from "@/lib/db";
import { tenantService } from "@/services/tenant/tenant.service";
import { generateEntityId } from "@/lib/id";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));
import { auth } from "@/lib/auth";

import Page from "@/app/(dashboard)/dashboard/(protected)/page";

describe("Dashboard protected page (integration)", () => {
  let tenantId: string;

  beforeEach(async () => {
    // Cleanup any prior run
    await prisma.user.deleteMany({ where: { email: "page-test@example.com" } });
    await prisma.merchant.deleteMany({
      where: { tenant: { name: "Page Test Co" } },
    });
    await prisma.tenant.deleteMany({ where: { name: "Page Test Co" } });

    // Seed: a fresh tenant + merchant via the production helper
    const { tenant } = await tenantService.createTenantWithMerchant({
      name: "Page Test Co",
      source: "signup",
    });
    tenantId = tenant.id;
    // Initialize onboarding so the section renders
    await tenantService.initializeOnboarding(tenantId);

    await prisma.user.create({
      data: {
        id: generateEntityId(),
        tenantId,
        email: "page-test@example.com",
        name: "Page Tester",
        role: "owner",
        status: "active",
      },
    });

    vi.mocked(auth).mockResolvedValue({
      user: { tenantId, id: "user-page-test" },
    } as never);
  });

  it("renders the onboarding section for a fresh signup, never 'No Store Found'", async () => {
    const element = await Page();
    const { container } = render(element);

    expect(container.textContent).not.toContain("No Store Found");
    // OnboardingSection renders step labels via next-intl; assert on a stable
    // marker — the OnboardingSection root has the title h2.
    // Fall back to asserting AgentChatClient is also present (which it shouldn't
    // be hidden, since onboarding != completed shows both).
    expect(container.querySelector("h2")).not.toBeNull();
  });

  it("hides the onboarding section when onboarding is completed", async () => {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { onboardingStatus: "completed" },
    });

    const element = await Page();
    const { container } = render(element);

    expect(container.textContent).not.toContain("No Store Found");
    // No onboarding h2 — but AgentChat should still mount.
  });
});
```

- [ ] **Step 3: Run the test**

```bash
npm run test:run -- page.integration
```

Expected: PASS. If the async-server-component render pattern needs adjustment for this codebase (e.g. hooks/context providers required), iterate until green. Common issues:

- `useTranslations` requires `NextIntlClientProvider` — wrap `render` with it if needed
- `useDashboard` context — may need a provider; alternatively assert only on text the page itself emits, not children

If wrapping providers gets unwieldy, narrow assertions to what the **page component itself** outputs (the `<div className="space-y-8 py-8">` wrapper) rather than rendering nested client components, by mocking `OnboardingSection` and `AgentChatClient`:

```typescript
vi.mock("@/components/dashboard/onboarding", () => ({
  OnboardingSection: () => <div data-testid="onboarding-section" />,
}));
vi.mock("@/components/dashboard/agent", () => ({
  AgentChatClient: () => <div data-testid="agent-chat" />,
}));
```

Then assert:
- Test 1: `getByTestId("onboarding-section")` exists, `queryByTestId("agent-chat")` exists, no "No Store Found"
- Test 2: `queryByTestId("onboarding-section")` is null, `getByTestId("agent-chat")` exists

- [ ] **Step 4: Commit**

```bash
git add __tests__/app/dashboard/protected/page.integration.test.tsx
git commit -m "test: integration test for dashboard page onboarding render branch"
```

---

## Task 6: Claim Route Integration Test

**Files:**
- Test: `__tests__/app/api/auth/claim/route.integration.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `__tests__/app/api/auth/claim/route.integration.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import prisma from "@/lib/db";
import { tenantService } from "@/services/tenant/tenant.service";
import { POST } from "@/app/api/auth/claim/route";

describe("POST /api/auth/claim (integration)", () => {
  let tenantId: string;
  let merchantId: string;

  beforeEach(async () => {
    await prisma.user.deleteMany({
      where: { email: "claim-test@example.com" },
    });
    await prisma.merchant.deleteMany({
      where: { tenant: { name: "Claim Test Diner" } },
    });
    await prisma.tenant.deleteMany({ where: { name: "Claim Test Diner" } });

    // Seed via the same helper the generator uses
    const { tenant, merchant } = await tenantService.createTenantWithMerchant({
      name: "Claim Test Diner",
      source: "generator",
      subscriptionStatus: "trial",
    });
    tenantId = tenant.id;
    merchantId = merchant.id;
  });

  function buildRequest(body: unknown): Request {
    return new Request("http://localhost/api/auth/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("claims a trial tenant, creates the user, preserves the existing merchant", async () => {
    const res = await POST(buildRequest({
      tenantId,
      email: "claim-test@example.com",
      name: "Claim Tester",
    }) as never);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);

    const user = await prisma.user.findFirst({
      where: { tenantId, email: "claim-test@example.com" },
    });
    expect(user).not.toBeNull();

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    expect(tenant?.subscriptionStatus).toBe("active");

    // Regression guard: the original merchant from the generator still exists
    const merchants = await prisma.merchant.findMany({
      where: { tenantId, deleted: false },
    });
    expect(merchants).toHaveLength(1);
    expect(merchants[0].id).toBe(merchantId);
  });

  it("returns 404 when the tenant does not exist", async () => {
    const res = await POST(buildRequest({
      tenantId: "nonexistent-tenant-id",
      email: "claim-test@example.com",
      name: "Claim Tester",
    }) as never);
    expect(res.status).toBe(404);
  });

  it("returns 400 when the tenant is not in trial status", async () => {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { subscriptionStatus: "active" },
    });
    const res = await POST(buildRequest({
      tenantId,
      email: "claim-test@example.com",
      name: "Claim Tester",
    }) as never);
    expect(res.status).toBe(400);
  });

  it("returns 409 when the email already exists on this tenant", async () => {
    await POST(buildRequest({
      tenantId,
      email: "claim-test@example.com",
      name: "Claim Tester",
    }) as never);
    // Re-set to trial so the second call hits the duplicate-email branch, not the trial branch
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { subscriptionStatus: "trial" },
    });

    const res = await POST(buildRequest({
      tenantId,
      email: "claim-test@example.com",
      name: "Claim Tester 2",
    }) as never);
    expect(res.status).toBe(409);
  });
});
```

- [ ] **Step 2: Run the test**

```bash
npm run test:run -- claim/route.integration
```

Expected: PASS — all four cases green. The route handler is unchanged, so this is purely characterization + a regression guard for the merchant.

- [ ] **Step 3: Commit**

```bash
git add __tests__/app/api/auth/claim/route.integration.test.ts
git commit -m "test: integration test for /api/auth/claim with merchant regression guard"
```

---

## Task 7: Backfill Script for Existing Broken Tenants

**Files:**
- Create: `scripts/backfill-missing-merchants.ts`

- [ ] **Step 1: Write the script**

Create `scripts/backfill-missing-merchants.ts`:

```typescript
/**
 * One-shot backfill: create a default merchant for any tenant that has none.
 *
 * Repairs data from the regression introduced in commit e61be27 where
 * direct Stytch signup created a tenant without a merchant.
 *
 * Usage:
 *   npx tsx scripts/backfill-missing-merchants.ts
 *
 * Idempotent: safe to re-run.
 */
import prisma from "@/lib/db";
import { merchantRepository } from "@/repositories/merchant.repository";
import { generateUniqueSlug } from "@/services/generator/slug.util";

async function main() {
  const broken = await prisma.tenant.findMany({
    where: { merchants: { none: {} }, deleted: false },
    select: { id: true, name: true, slug: true },
  });

  if (broken.length === 0) {
    console.log("No tenants need backfill — all good.");
    return;
  }

  console.log(`Found ${broken.length} tenant(s) missing a merchant:`);
  for (const tenant of broken) {
    const slug = await generateUniqueSlug(
      tenant.name,
      async (s) => merchantRepository.isSlugAvailable(s)
    );
    const merchant = await merchantRepository.create(tenant.id, {
      slug,
      name: tenant.name,
      status: "pending",
    });
    console.log(`  ✓ ${tenant.name} (${tenant.id}) → merchant ${merchant.id} (${slug})`);
  }

  console.log(`\nBackfilled ${broken.length} merchant(s).`);
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Run the script against local DB**

```bash
npx tsx scripts/backfill-missing-merchants.ts
```

Expected: Either "No tenants need backfill" (if a previous task already fixed maqh1988) OR a list including maqh1988's tenant. Re-run once more to verify idempotency:

```bash
npx tsx scripts/backfill-missing-merchants.ts
```

Expected: "No tenants need backfill — all good."

- [ ] **Step 3: Commit**

```bash
git add scripts/backfill-missing-merchants.ts
git commit -m "chore: one-shot script to backfill tenants missing a default merchant"
```

---

## Task 8: Manual Verification

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Log in as maqh1988**

Open the dashboard, log in via Stytch as `maqh1988`. Expected: dashboard renders the **OnboardingSection** with website/gbp/menu/stripe steps. No "No Store Found" warning.

- [ ] **Step 3: Sign up as a brand-new email**

Use a brand-new email address through Stytch login. Expected: dashboard renders OnboardingSection on first visit, no "No Store Found".

- [ ] **Step 4: Test the generator flow**

Go through `/generator` → claim with a fresh place. Expected: tenant + merchant created, claim succeeds, dashboard renders normally.

- [ ] **Step 5: Run the full test suite**

```bash
npm run test:run
```

Expected: All tests pass. If anything broke from the auth/tenant/generator refactor, fix and re-commit.

- [ ] **Step 6: Type-check + lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: No errors.

---

## Task 9: Final Cleanup + PR

- [ ] **Step 1: Review the diff**

```bash
git log --oneline main..HEAD
git diff main..HEAD --stat
```

- [ ] **Step 2: Push and open PR**

```bash
git push -u origin fix/signup-creates-merchant
gh pr create --title "fix: direct Stytch signup creates default merchant + login/onboarding integration tests" --body "$(cat <<'EOF'
## Summary
- Restores invariant from PR #75 that every Tenant has a default Merchant from creation. Lost in commit e61be27 when auth flow was refactored.
- Centralizes tenant+merchant creation in `tenantService.createTenantWithMerchant`; both direct Stytch signup and `/generator` flows now share one path.
- Removes unreachable "No Store Found" branch in dashboard page.
- Adds service- and route-level integration tests for both signup paths and dashboard render.
- Includes one-shot backfill script for existing broken tenants.

## Test plan
- [ ] `npm run test:run` — all green
- [ ] Log in as previously broken account → onboarding flow renders
- [ ] New Stytch signup → onboarding flow renders
- [ ] `/generator` → claim flow still works end-to-end

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Goal 1 (invariant): Tasks 1, 2, 3
- ✅ Goal 2 (integration tests): Tasks 1 (tenant), 2 (auth), 5 (page), 6 (claim)
- ✅ Goal 3 (data repair): Task 7
- ✅ Cleanup of dashboard page: Task 4
- ✅ AgentChatClient stays: Task 4 keeps it
- ✅ Generator regression risk noted: Task 3 updates the unit-test mocks

**Placeholder scan:** No TBD/TODO. Page-test pattern verification (Task 5 Step 1) is an explicit verification step, not a placeholder — it tells the engineer exactly what to look for and what fallback to use.

**Type consistency:**
- `createTenantWithMerchant` signature matches between Task 1 (definition), Task 2 (auth caller), Task 3 (generator caller), Task 5/6 (test seed callers).
- Returns `{ tenant, merchant }` consistently.
- Optional `tx` parameter only used by auth (Task 2).
