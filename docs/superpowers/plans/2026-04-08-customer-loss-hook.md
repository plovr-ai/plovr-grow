# Customer Loss Hook Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a marketing calculator page at `/customer-loss` that shows restaurants how many repeat customers they lose monthly, captures leads via email, and redirects to the website generator.

**Architecture:** Single-page client component inside the `(platform)` route group. Form collects monthly orders and AOV, computes customer churn client-side using hardcoded industry rates, animates to a result view with bar chart and lead capture form. Reuses the `Lead` Prisma model (with `source` field) and `POST /api/leads` API from #29. Reuses `LeadCaptureForm` component from #29's calculator page.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS 4, Prisma, Zod, next-intl, Vitest

**Spec:** `docs/superpowers/specs/2026-04-08-customer-loss-hook-design.md`

**Depends on:** #29 (Calculator Hook Page) — must be merged before implementation begins.

**Worktree:** `../plovr-grow-issue-31`
**Branch:** `feat/issue-31-customer-losing-hook`

---

### Task 1: Extend Lead Model with `source` Field

**Files:**
- Modify: `prisma/schema.prisma` (add `source` field to Lead model)
- Modify: `src/app/api/leads/route.ts` (add `source` to Zod schema)
- Modify: `src/app/api/leads/__tests__/create.route.test.ts` (add source tests)

**Prerequisite:** #29 must be merged. Rebase this branch onto latest `main` first:
```bash
git fetch origin main
git rebase origin/main
```

- [ ] **Step 1: Add `source` field to Lead model**

In `prisma/schema.prisma`, add to the `Lead` model:

```prisma
model Lead {
  id          String   @id @default(cuid())
  email       String
  revenue     Float
  aov         Float
  platform    String
  monthlyLoss Float    @map("monthly_loss")
  source      String   @default("calculator")
  createdAt   DateTime @default(now()) @map("created_at")

  @@map("leads")
}
```

- [ ] **Step 2: Generate Prisma client**

Run: `npm run db:generate`
Expected: `Generated Prisma Client` output, no errors.

- [ ] **Step 3: Push schema to database**

Run: `npm run db:push`
Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 4: Add `source` to API Zod schema**

In `src/app/api/leads/route.ts`, update the Zod schema to accept an optional `source` field:

```typescript
const leadSchema = z.object({
  email: z.string().email("Invalid email format"),
  revenue: z.number().positive("Revenue must be positive"),
  aov: z.number().positive("AOV must be positive"),
  platform: z.enum(["doordash", "ubereats", "both"]),
  monthlyLoss: z.number().positive("Monthly loss must be positive"),
  source: z.enum(["calculator", "customer-loss"]).default("calculator"),
});
```

- [ ] **Step 5: Add test for source field**

In `src/app/api/leads/__tests__/create.route.test.ts`, add these test cases:

```typescript
it("accepts customer-loss source", async () => {
  mockCreate.mockResolvedValue({ id: "lead-2", ...validBody, source: "customer-loss" });

  const res = await POST(makeRequest({ ...validBody, source: "customer-loss" }));
  expect(res.status).toBe(201);
  expect(mockCreate).toHaveBeenCalledWith({
    data: { ...validBody, source: "customer-loss" },
  });
});

it("defaults source to calculator when not provided", async () => {
  mockCreate.mockResolvedValue({ id: "lead-3", ...validBody, source: "calculator" });

  const res = await POST(makeRequest(validBody));
  expect(res.status).toBe(201);
  expect(mockCreate).toHaveBeenCalledWith({
    data: { ...validBody, source: "calculator" },
  });
});

it("returns 400 for invalid source", async () => {
  const res = await POST(makeRequest({ ...validBody, source: "unknown" }));
  expect(res.status).toBe(400);
});
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run src/app/api/leads/__tests__/create.route.test.ts`
Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma src/app/api/leads/route.ts src/app/api/leads/__tests__/create.route.test.ts
git commit -m "feat: add source field to Lead model and API (#31)"
```

---

### Task 2: i18n Translations

**Files:**
- Modify: `src/messages/shared/en.json`

- [ ] **Step 1: Add `customerLoss` namespace**

Add a `"customerLoss"` key to `src/messages/shared/en.json` at the top level (alongside existing `"errors"` key):

```json
"customerLoss": {
  "pageTitle": "Restaurant Customer Loss Calculator — How Many Regulars Are You Losing?",
  "pageDescription": "Most restaurants lose 20-30% of repeat customers monthly. Calculate your customer churn and revenue impact in seconds.",
  "headline": "How many customers are you losing?",
  "subheadline": "Most restaurants lose 20–30% of repeat customers monthly",
  "ordersLabel": "Monthly orders",
  "ordersPlaceholder": "Enter your monthly order count",
  "aovLabel": "Average order value",
  "calculateButton": "Analyze customer loss",
  "trustMessage": "Based on industry averages",
  "resultLostCustomers": "You're losing ~{count} customers/month",
  "resultMonthlyLoss": "That's {amount}/month in lost revenue",
  "resultYearlyLoss": "{amount}/year",
  "chartTotalCustomers": "Your customers",
  "chartLostCustomers": "Lost monthly",
  "sellingPoint1": "Loyalty programs retain customers",
  "sellingPoint2": "Direct ordering builds relationships",
  "ctaHeadline": "Stop losing customers",
  "emailPlaceholder": "your@email.com",
  "continueButton": "Continue",
  "submitting": "Submitting...",
  "emailRequired": "Email is required",
  "emailInvalid": "Please enter a valid email",
  "submitError": "Something went wrong. Please try again."
}
```

- [ ] **Step 2: Verify JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/messages/shared/en.json','utf8')); console.log('Valid JSON')"`
Expected: `Valid JSON`

- [ ] **Step 3: Commit**

```bash
git add src/messages/shared/en.json
git commit -m "feat: add customerLoss i18n translations (#31)"
```

---

### Task 3: Calculation Logic + Tests (TDD)

**Files:**
- Create: `src/app/(platform)/customer-loss/__tests__/customer-loss.test.ts`
- Create: `src/app/(platform)/customer-loss/customer-loss.utils.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/app/(platform)/customer-loss/__tests__/customer-loss.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  calculateCustomerLoss,
  CHURN_RATE,
  ORDERS_PER_CUSTOMER,
} from "../customer-loss.utils";

describe("calculateCustomerLoss", () => {
  it("calculates estimated customers from monthly orders", () => {
    const result = calculateCustomerLoss(200, 25);
    // 200 orders / 2 orders per customer = 100 customers
    expect(result.estimatedCustomers).toBe(100);
  });

  it("calculates lost customers at 25% churn rate", () => {
    const result = calculateCustomerLoss(200, 25);
    // 100 customers * 0.25 = 25 lost
    expect(result.lostCustomers).toBe(25);
  });

  it("calculates monthly revenue loss", () => {
    const result = calculateCustomerLoss(200, 25);
    // 25 lost customers * $25 AOV * 2 orders/month = $1,250
    expect(result.monthlyRevenueLoss).toBe(1250);
  });

  it("calculates yearly revenue loss", () => {
    const result = calculateCustomerLoss(200, 25);
    // $1,250/month * 12 = $15,000
    expect(result.yearlyRevenueLoss).toBe(15000);
  });

  it("rounds estimated customers to nearest integer", () => {
    const result = calculateCustomerLoss(75, 30);
    // 75 / 2 = 37.5 → 38
    expect(result.estimatedCustomers).toBe(38);
  });

  it("rounds lost customers to nearest integer", () => {
    const result = calculateCustomerLoss(75, 30);
    // 38 * 0.25 = 9.5 → 10
    expect(result.lostCustomers).toBe(10);
  });

  it("handles small order counts", () => {
    const result = calculateCustomerLoss(10, 20);
    // 10 / 2 = 5 customers, 5 * 0.25 = 1.25 → 1 lost
    expect(result.estimatedCustomers).toBe(5);
    expect(result.lostCustomers).toBe(1);
    expect(result.monthlyRevenueLoss).toBe(40); // 1 * 20 * 2
    expect(result.yearlyRevenueLoss).toBe(480);
  });

  it("handles high AOV", () => {
    const result = calculateCustomerLoss(400, 50);
    // 200 customers, 50 lost, $5,000/month, $60,000/year
    expect(result.estimatedCustomers).toBe(200);
    expect(result.lostCustomers).toBe(50);
    expect(result.monthlyRevenueLoss).toBe(5000);
    expect(result.yearlyRevenueLoss).toBe(60000);
  });
});

describe("constants", () => {
  it("CHURN_RATE is 25%", () => {
    expect(CHURN_RATE).toBe(0.25);
  });

  it("ORDERS_PER_CUSTOMER is 2", () => {
    expect(ORDERS_PER_CUSTOMER).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/\(platform\)/customer-loss/__tests__/customer-loss.test.ts`
Expected: FAIL — cannot find module `../customer-loss.utils`

- [ ] **Step 3: Implement the calculation utils**

Create `src/app/(platform)/customer-loss/customer-loss.utils.ts`:

```typescript
export const CHURN_RATE = 0.25;
export const ORDERS_PER_CUSTOMER = 2;

export interface CustomerLossResult {
  estimatedCustomers: number;
  lostCustomers: number;
  monthlyRevenueLoss: number;
  yearlyRevenueLoss: number;
}

export function calculateCustomerLoss(
  monthlyOrders: number,
  aov: number
): CustomerLossResult {
  const estimatedCustomers = Math.round(monthlyOrders / ORDERS_PER_CUSTOMER);
  const lostCustomers = Math.round(estimatedCustomers * CHURN_RATE);
  const monthlyRevenueLoss = lostCustomers * aov * ORDERS_PER_CUSTOMER;
  const yearlyRevenueLoss = monthlyRevenueLoss * 12;
  return { estimatedCustomers, lostCustomers, monthlyRevenueLoss, yearlyRevenueLoss };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/\(platform\)/customer-loss/__tests__/customer-loss.test.ts`
Expected: All 10 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(platform\)/customer-loss/__tests__/customer-loss.test.ts src/app/\(platform\)/customer-loss/customer-loss.utils.ts
git commit -m "feat: add customer loss calculation utils with tests (#31)"
```

---

### Task 4: CustomerLossForm Component

**Files:**
- Create: `src/app/(platform)/customer-loss/components/CustomerLossForm.tsx`

- [ ] **Step 1: Create the form component**

Create `src/app/(platform)/customer-loss/components/CustomerLossForm.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

interface CustomerLossFormValues {
  monthlyOrders: number;
  aov: number;
}

interface CustomerLossFormProps {
  onSubmit: (values: CustomerLossFormValues) => void;
}

export function CustomerLossForm({ onSubmit }: CustomerLossFormProps) {
  const t = useTranslations("customerLoss");
  const [orders, setOrders] = useState("");
  const [aov, setAov] = useState("25");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ordersNum = parseFloat(orders);
    const aovNum = parseFloat(aov);
    if (ordersNum > 0 && aovNum > 0) {
      onSubmit({ monthlyOrders: ordersNum, aov: aovNum });
    }
  };

  const isValid = parseFloat(orders) > 0 && parseFloat(aov) > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 w-full max-w-md">
      <div>
        <label
          htmlFor="orders"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {t("ordersLabel")}
        </label>
        <input
          id="orders"
          type="number"
          min="1"
          step="1"
          value={orders}
          onChange={(e) => setOrders(e.target.value)}
          placeholder={t("ordersPlaceholder")}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
          required
        />
      </div>

      <div>
        <label
          htmlFor="aov"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {t("aovLabel")}
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
            $
          </span>
          <input
            id="aov"
            type="number"
            min="1"
            step="0.01"
            value={aov}
            onChange={(e) => setAov(e.target.value)}
            className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
            required
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={!isValid}
        className="w-full py-3 px-6 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-lg"
      >
        {t("calculateButton")}
      </button>

      <p className="text-center text-sm text-gray-500">{t("trustMessage")}</p>
    </form>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to `CustomerLossForm.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(platform\)/customer-loss/components/CustomerLossForm.tsx
git commit -m "feat: add CustomerLossForm component (#31)"
```

---

### Task 5: CustomerLossResult Component

**Files:**
- Create: `src/app/(platform)/customer-loss/components/CustomerLossResult.tsx`

This component reuses `LeadCaptureForm` from #29's calculator page.

- [ ] **Step 1: Create the result component**

Create `src/app/(platform)/customer-loss/components/CustomerLossResult.tsx`:

```typescript
"use client";

import { useEffect, useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { LeadCaptureForm } from "../../calculator/components/LeadCaptureForm";

interface CustomerLossResultProps {
  estimatedCustomers: number;
  lostCustomers: number;
  monthlyRevenueLoss: number;
  yearlyRevenueLoss: number;
  monthlyOrders: number;
  aov: number;
}

function useCountUp(target: number, duration = 1500): number {
  const [value, setValue] = useState(0);
  const startTime = useRef<number | null>(null);

  useEffect(() => {
    startTime.current = null;
    const animate = (timestamp: number) => {
      if (startTime.current === null) startTime.current = timestamp;
      const progress = Math.min((timestamp - startTime.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [target, duration]);

  return value;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function CustomerLossResult({
  estimatedCustomers,
  lostCustomers,
  monthlyRevenueLoss,
  yearlyRevenueLoss,
  monthlyOrders,
  aov,
}: CustomerLossResultProps) {
  const t = useTranslations("customerLoss");
  const router = useRouter();
  const animatedLostCustomers = useCountUp(lostCustomers);
  const animatedMonthlyLoss = useCountUp(monthlyRevenueLoss);
  const animatedYearlyLoss = useCountUp(yearlyRevenueLoss);

  const totalBarWidth = 100;
  const lostBarWidth = Math.round((lostCustomers / estimatedCustomers) * 100);

  const handleLeadSubmit = async (email: string) => {
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        revenue: monthlyOrders * aov,
        aov,
        platform: "both",
        monthlyLoss: monthlyRevenueLoss,
        source: "customer-loss",
      }),
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error("Failed to submit");
    }

    router.push("/generator");
  };

  return (
    <div className="w-full max-w-lg space-y-8 animate-fade-in">
      {/* Headline */}
      <div className="text-center">
        <h2 className="text-4xl md:text-5xl font-bold text-red-600">
          {t("resultLostCustomers", { count: animatedLostCustomers })}
        </h2>
        <p className="mt-2 text-xl text-gray-800">
          {t("resultMonthlyLoss", { amount: formatCurrency(animatedMonthlyLoss) })}
        </p>
        <p className="mt-1 text-lg text-gray-500">
          {t("resultYearlyLoss", { amount: formatCurrency(animatedYearlyLoss) })}
        </p>
      </div>

      {/* Bar Chart */}
      <div className="space-y-4 bg-gray-50 rounded-xl p-6">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="font-medium text-gray-700">
              {t("chartTotalCustomers")}
            </span>
            <span className="font-semibold text-gray-900">
              {estimatedCustomers}
            </span>
          </div>
          <div className="h-8 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${totalBarWidth}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="font-medium text-gray-700">
              {t("chartLostCustomers")}
            </span>
            <span className="font-semibold text-red-600">
              {animatedLostCustomers}
            </span>
          </div>
          <div className="h-8 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-500 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${lostBarWidth}%` }}
            />
          </div>
        </div>
      </div>

      {/* Selling Points */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-gray-700">
          <span className="text-green-500 text-lg">&#10003;</span>
          <span>{t("sellingPoint1")}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-700">
          <span className="text-green-500 text-lg">&#10003;</span>
          <span>{t("sellingPoint2")}</span>
        </div>
      </div>

      {/* CTA */}
      <div className="space-y-3">
        <h3 className="text-xl font-semibold text-center text-gray-900">
          {t("ctaHeadline")}
        </h3>
        <LeadCaptureForm onSubmit={handleLeadSubmit} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to `CustomerLossResult.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(platform\)/customer-loss/components/CustomerLossResult.tsx
git commit -m "feat: add CustomerLossResult component (#31)"
```

---

### Task 6: CustomerLossPage Container + Page Route

**Files:**
- Create: `src/app/(platform)/customer-loss/components/CustomerLossPage.tsx`
- Create: `src/app/(platform)/customer-loss/page.tsx`
- Modify: `src/app/globals.css` (add fade-in animation if not already present from #29)

- [ ] **Step 1: Create the main container component**

Create `src/app/(platform)/customer-loss/components/CustomerLossPage.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { calculateCustomerLoss } from "../customer-loss.utils";
import type { CustomerLossResult as CustomerLossResultType } from "../customer-loss.utils";
import { CustomerLossForm } from "./CustomerLossForm";
import { CustomerLossResult } from "./CustomerLossResult";

interface FormValues {
  monthlyOrders: number;
  aov: number;
}

interface ResultData extends CustomerLossResultType {
  monthlyOrders: number;
  aov: number;
}

export function CustomerLossPage() {
  const t = useTranslations("customerLoss");
  const [result, setResult] = useState<ResultData | null>(null);

  const handleCalculate = (values: FormValues) => {
    const lossResult = calculateCustomerLoss(values.monthlyOrders, values.aov);
    setResult({ ...lossResult, monthlyOrders: values.monthlyOrders, aov: values.aov });
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-12">
      <div
        className={`transition-all duration-500 ease-in-out flex flex-col items-center ${
          result
            ? "opacity-0 translate-y-[-20px] h-0 overflow-hidden"
            : "opacity-100 translate-y-0"
        }`}
      >
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 text-center mb-2">
          {t("headline")}
        </h1>
        <p className="text-lg text-gray-600 text-center mb-8">
          {t("subheadline")}
        </p>
        <CustomerLossForm onSubmit={handleCalculate} />
      </div>

      {result && (
        <CustomerLossResult
          estimatedCustomers={result.estimatedCustomers}
          lostCustomers={result.lostCustomers}
          monthlyRevenueLoss={result.monthlyRevenueLoss}
          yearlyRevenueLoss={result.yearlyRevenueLoss}
          monthlyOrders={result.monthlyOrders}
          aov={result.aov}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the page route with metadata**

Create `src/app/(platform)/customer-loss/page.tsx`:

```typescript
import type { Metadata } from "next";
import { CustomerLossPage } from "./components/CustomerLossPage";

export const metadata: Metadata = {
  title: "Restaurant Customer Loss Calculator — How Many Regulars Are You Losing? | Plovr",
  description:
    "Most restaurants lose 20-30% of repeat customers monthly. Calculate your customer churn and revenue impact in seconds.",
  openGraph: {
    title: "Restaurant Customer Loss Calculator — How Many Regulars Are You Losing?",
    description:
      "Most restaurants lose 20-30% of repeat customers monthly. Calculate your customer churn and revenue impact in seconds.",
    type: "website",
  },
};

export default function CustomerLossRoute() {
  return <CustomerLossPage />;
}
```

- [ ] **Step 3: Add fade-in animation to globals.css (if not already present)**

Check if `animate-fade-in` is already defined in `src/app/globals.css` (may have been added by #29). If NOT present, add the following inside the `@theme inline` block:

```css
--animate-fade-in: fade-in 0.5s ease-out;
```

And add this at the end of `src/app/globals.css`:

```css
@keyframes fade-in {
  0% { opacity: 0; transform: translateY(20px); }
  100% { opacity: 1; transform: translateY(0); }
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(platform\)/customer-loss/components/CustomerLossPage.tsx src/app/\(platform\)/customer-loss/page.tsx src/app/globals.css
git commit -m "feat: add customer loss page route and container (#31)"
```

---

### Task 7: Full Test Suite + Final Verification

**Files:**
- Existing test and source files

- [ ] **Step 1: Run all customer loss tests**

Run: `npx vitest run src/app/\(platform\)/customer-loss/`
Expected: All tests PASS.

- [ ] **Step 2: Run all lead API tests**

Run: `npx vitest run src/app/api/leads/`
Expected: All tests PASS.

- [ ] **Step 3: Run full test suite**

Run: `npm run test:run`
Expected: All existing tests still pass (no regressions).

- [ ] **Step 4: Run type check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: No errors.

- [ ] **Step 5: Commit any remaining fixes (if needed)**

If any fixes were required:
```bash
git add -A
git commit -m "fix: resolve test/lint issues for customer loss page (#31)"
```
