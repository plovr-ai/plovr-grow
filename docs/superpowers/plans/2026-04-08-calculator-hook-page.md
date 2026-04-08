# Calculator Hook Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a marketing calculator page at `/calculator` that shows restaurants how much they lose to delivery platform fees, captures leads via email, and redirects to the website generator.

**Architecture:** Single-page client component inside the `(platform)` route group. Form collects revenue/AOV/platform, computes loss client-side using hardcoded industry rates, animates to a result view with bar chart and lead capture form. Lead data stored in a new `Lead` Prisma model via `POST /api/leads`.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS, Prisma, Zod, next-intl, Vitest

**Spec:** `docs/superpowers/specs/2026-04-08-calculator-hook-page-design.md`

**Worktree:** `/Users/allan/workspace/plovr/plovr-grow-issue-29`
**Branch:** `feat/issue-29-calculate-hook-page`

---

### Task 1: Prisma Lead Model

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add Lead model to schema**

Append to `prisma/schema.prisma`:

```prisma
model Lead {
  id          String   @id @default(cuid())
  email       String
  revenue     Float
  aov         Float
  platform    String
  monthlyLoss Float    @map("monthly_loss")
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

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add Lead model for calculator hook page (#29)"
```

---

### Task 2: Lead API Route + Tests (TDD)

**Files:**
- Create: `src/app/api/leads/__tests__/create.route.test.ts`
- Create: `src/app/api/leads/route.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/app/api/leads/__tests__/create.route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockCreate = vi.fn();

vi.mock("@/lib/db", () => ({
  default: {
    lead: {
      create: mockCreate,
    },
  },
}));

import { POST } from "../route";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/leads", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const validBody = {
  email: "owner@restaurant.com",
  revenue: 5000,
  aov: 25,
  platform: "doordash",
  monthlyLoss: 1400,
};

describe("POST /api/leads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a lead and returns success", async () => {
    mockCreate.mockResolvedValue({ id: "lead-1", ...validBody });

    const res = await POST(makeRequest(validBody));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data).toEqual({ success: true });
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        email: "owner@restaurant.com",
        revenue: 5000,
        aov: 25,
        platform: "doordash",
        monthlyLoss: 1400,
      },
    });
  });

  it("returns 400 for missing email", async () => {
    const { email: _, ...noEmail } = validBody;
    const res = await POST(makeRequest(noEmail));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  it("returns 400 for invalid email format", async () => {
    const res = await POST(makeRequest({ ...validBody, email: "not-an-email" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for negative revenue", async () => {
    const res = await POST(makeRequest({ ...validBody, revenue: -100 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid platform", async () => {
    const res = await POST(makeRequest({ ...validBody, platform: "grubhub" }));
    expect(res.status).toBe(400);
  });

  it("returns 500 when database fails", async () => {
    mockCreate.mockRejectedValue(new Error("DB connection failed"));

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/api/leads/__tests__/create.route.test.ts`
Expected: FAIL — cannot find module `../route`

- [ ] **Step 3: Implement the API route**

Create `src/app/api/leads/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";

const leadSchema = z.object({
  email: z.string().email("Invalid email format"),
  revenue: z.number().positive("Revenue must be positive"),
  aov: z.number().positive("AOV must be positive"),
  platform: z.enum(["doordash", "ubereats", "both"]),
  monthlyLoss: z.number().positive("Monthly loss must be positive"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = leadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          fieldErrors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    await prisma.lead.create({
      data: parsed.data,
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("[Leads] Create error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/api/leads/__tests__/create.route.test.ts`
Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/leads/
git commit -m "feat: add POST /api/leads route with Zod validation (#29)"
```

---

### Task 3: i18n Translations

**Files:**
- Modify: `src/messages/shared/en.json`

- [ ] **Step 1: Add calculator namespace to shared translations**

Add a `"calculator"` key to `src/messages/shared/en.json` at the top level:

```json
"calculator": {
  "pageTitle": "How Much Are You Losing to Delivery Fees?",
  "pageDescription": "Calculate how much your restaurant loses to delivery platform fees every month.",
  "headline": "How much are you losing to delivery fees?",
  "subheadline": "Most restaurants lose $1k–$3k/month",
  "revenueLabel": "Monthly delivery revenue",
  "revenuePlaceholder": "Enter your monthly delivery revenue",
  "aovLabel": "Average order value",
  "platformLabel": "Platform",
  "platformDoordash": "DoorDash",
  "platformUbereats": "Uber Eats",
  "platformBoth": "Both",
  "calculateButton": "Calculate my loss",
  "trustMessage": "Based on industry averages",
  "resultHeadline": "You're losing {amount}/month",
  "resultYearly": "That's {amount}/year",
  "chartPlatform": "Platform fees",
  "chartDirect": "Direct ordering",
  "sellingPoint1": "Direct ordering — no fees",
  "sellingPoint2": "Customer retention",
  "ctaHeadline": "Start saving today",
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
git commit -m "feat: add calculator i18n translations (#29)"
```

---

### Task 4: Calculation Logic + Tests (TDD)

**Files:**
- Create: `src/app/(platform)/calculator/__tests__/calculator.test.ts`
- Create: `src/app/(platform)/calculator/calculator.utils.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/app/(platform)/calculator/__tests__/calculator.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  calculateMonthlyLoss,
  calculateYearlyLoss,
  PLATFORM_FEES,
  type Platform,
} from "../calculator.utils";

describe("calculateMonthlyLoss", () => {
  it("calculates DoorDash loss (25% + 3% = 28%)", () => {
    const result = calculateMonthlyLoss(10000, "doordash");
    expect(result).toBe(2800);
  });

  it("calculates Uber Eats loss (28% + 3% = 31%)", () => {
    const result = calculateMonthlyLoss(10000, "ubereats");
    expect(result).toBe(3100);
  });

  it("calculates Both platforms loss (26.5% + 3% = 29.5%)", () => {
    const result = calculateMonthlyLoss(10000, "both");
    expect(result).toBe(2950);
  });

  it("handles small revenue amounts", () => {
    const result = calculateMonthlyLoss(100, "doordash");
    expect(result).toBe(28);
  });

  it("handles decimal results by rounding to nearest cent", () => {
    const result = calculateMonthlyLoss(333, "doordash");
    expect(result).toBe(93.24);
  });
});

describe("calculateYearlyLoss", () => {
  it("returns monthly loss times 12", () => {
    const result = calculateYearlyLoss(2800);
    expect(result).toBe(33600);
  });
});

describe("PLATFORM_FEES", () => {
  it("has all three platforms defined", () => {
    expect(PLATFORM_FEES.doordash).toBeDefined();
    expect(PLATFORM_FEES.ubereats).toBeDefined();
    expect(PLATFORM_FEES.both).toBeDefined();
  });

  it("each platform has commissionRate and marketingFee", () => {
    const platforms: Platform[] = ["doordash", "ubereats", "both"];
    for (const p of platforms) {
      expect(PLATFORM_FEES[p].commissionRate).toBeGreaterThan(0);
      expect(PLATFORM_FEES[p].marketingFee).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/(platform)/calculator/__tests__/calculator.test.ts`
Expected: FAIL — cannot find module `../calculator.utils`

- [ ] **Step 3: Implement the calculation utils**

Create `src/app/(platform)/calculator/calculator.utils.ts`:

```typescript
export const PLATFORM_FEES = {
  doordash: { commissionRate: 0.25, marketingFee: 0.03 },
  ubereats: { commissionRate: 0.28, marketingFee: 0.03 },
  both: { commissionRate: 0.265, marketingFee: 0.03 },
} as const;

export type Platform = keyof typeof PLATFORM_FEES;

export function calculateMonthlyLoss(
  revenue: number,
  platform: Platform
): number {
  const { commissionRate, marketingFee } = PLATFORM_FEES[platform];
  const loss = revenue * (commissionRate + marketingFee);
  return Math.round(loss * 100) / 100;
}

export function calculateYearlyLoss(monthlyLoss: number): number {
  return Math.round(monthlyLoss * 12 * 100) / 100;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/(platform)/calculator/__tests__/calculator.test.ts`
Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(platform\)/calculator/__tests__/calculator.test.ts src/app/\(platform\)/calculator/calculator.utils.ts
git commit -m "feat: add calculator utility functions with tests (#29)"
```

---

### Task 5: CalculatorForm Component

**Files:**
- Create: `src/app/(platform)/calculator/components/CalculatorForm.tsx`

- [ ] **Step 1: Create the form component**

Create `src/app/(platform)/calculator/components/CalculatorForm.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Platform } from "../calculator.utils";

interface CalculatorFormValues {
  revenue: number;
  aov: number;
  platform: Platform;
}

interface CalculatorFormProps {
  onSubmit: (values: CalculatorFormValues) => void;
}

const PLATFORMS: { value: Platform; labelKey: string }[] = [
  { value: "doordash", labelKey: "platformDoordash" },
  { value: "ubereats", labelKey: "platformUbereats" },
  { value: "both", labelKey: "platformBoth" },
];

export function CalculatorForm({ onSubmit }: CalculatorFormProps) {
  const t = useTranslations("calculator");
  const [revenue, setRevenue] = useState("");
  const [aov, setAov] = useState("25");
  const [platform, setPlatform] = useState<Platform>("doordash");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const revenueNum = parseFloat(revenue);
    const aovNum = parseFloat(aov);
    if (revenueNum > 0 && aovNum > 0) {
      onSubmit({ revenue: revenueNum, aov: aovNum, platform });
    }
  };

  const isValid = parseFloat(revenue) > 0 && parseFloat(aov) > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 w-full max-w-md">
      <div>
        <label
          htmlFor="revenue"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {t("revenueLabel")}
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
            $
          </span>
          <input
            id="revenue"
            type="number"
            min="1"
            step="1"
            value={revenue}
            onChange={(e) => setRevenue(e.target.value)}
            placeholder={t("revenuePlaceholder")}
            className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
            required
          />
        </div>
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

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t("platformLabel")}
        </label>
        <div className="grid grid-cols-3 gap-2">
          {PLATFORMS.map(({ value, labelKey }) => (
            <button
              key={value}
              type="button"
              onClick={() => setPlatform(value)}
              className={`py-3 px-4 rounded-lg border text-sm font-medium transition-colors ${
                platform === value
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-700 border-gray-300 hover:border-blue-300"
              }`}
            >
              {t(labelKey)}
            </button>
          ))}
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
Expected: No errors related to `CalculatorForm.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(platform\)/calculator/components/CalculatorForm.tsx
git commit -m "feat: add CalculatorForm component (#29)"
```

---

### Task 6: CalculatorResult + LeadCaptureForm Components

**Files:**
- Create: `src/app/(platform)/calculator/components/CalculatorResult.tsx`
- Create: `src/app/(platform)/calculator/components/LeadCaptureForm.tsx`

- [ ] **Step 1: Create the LeadCaptureForm component**

Create `src/app/(platform)/calculator/components/LeadCaptureForm.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

interface LeadCaptureFormProps {
  onSubmit: (email: string) => Promise<void>;
}

export function LeadCaptureForm({ onSubmit }: LeadCaptureFormProps) {
  const t = useTranslations("calculator");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError(t("emailRequired"));
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError(t("emailInvalid"));
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(email);
    } catch {
      setError(t("submitError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("emailPlaceholder")}
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
          disabled={submitting}
        />
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {submitting ? t("submitting") : t("continueButton")}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </form>
  );
}
```

- [ ] **Step 2: Create the CalculatorResult component**

Create `src/app/(platform)/calculator/components/CalculatorResult.tsx`:

```typescript
"use client";

import { useEffect, useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import type { Platform } from "../calculator.utils";
import { LeadCaptureForm } from "./LeadCaptureForm";

interface CalculatorResultProps {
  monthlyLoss: number;
  yearlyLoss: number;
  revenue: number;
  aov: number;
  platform: Platform;
}

function useCountUp(target: number, duration = 1500): number {
  const [value, setValue] = useState(0);
  const startTime = useRef<number | null>(null);

  useEffect(() => {
    startTime.current = null;
    const animate = (timestamp: number) => {
      if (startTime.current === null) startTime.current = timestamp;
      const progress = Math.min((timestamp - startTime.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
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

export function CalculatorResult({
  monthlyLoss,
  yearlyLoss,
  revenue,
  aov,
  platform,
}: CalculatorResultProps) {
  const t = useTranslations("calculator");
  const router = useRouter();
  const animatedMonthly = useCountUp(monthlyLoss);
  const animatedYearly = useCountUp(yearlyLoss);

  const barMaxWidth = 100;
  const platformBarWidth = barMaxWidth;
  const directBarWidth = 0;

  const handleLeadSubmit = async (email: string) => {
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        revenue,
        aov,
        platform,
        monthlyLoss,
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
          {t("resultHeadline", { amount: formatCurrency(animatedMonthly) })}
        </h2>
        <p className="mt-2 text-xl text-gray-600">
          {t("resultYearly", { amount: formatCurrency(animatedYearly) })}
        </p>
      </div>

      {/* Bar Chart */}
      <div className="space-y-4 bg-gray-50 rounded-xl p-6">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="font-medium text-gray-700">
              {t("chartPlatform")}
            </span>
            <span className="font-semibold text-red-600">
              {formatCurrency(animatedMonthly)}
            </span>
          </div>
          <div className="h-8 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-500 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${platformBarWidth}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="font-medium text-gray-700">
              {t("chartDirect")}
            </span>
            <span className="font-semibold text-green-600">
              {formatCurrency(0)}
            </span>
          </div>
          <div className="h-8 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${directBarWidth}%` }}
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

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to these files.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(platform\)/calculator/components/CalculatorResult.tsx src/app/\(platform\)/calculator/components/LeadCaptureForm.tsx
git commit -m "feat: add CalculatorResult and LeadCaptureForm components (#29)"
```

---

### Task 7: CalculatorPage Container + Page Route

**Files:**
- Create: `src/app/(platform)/calculator/components/CalculatorPage.tsx`
- Create: `src/app/(platform)/calculator/page.tsx`

- [ ] **Step 1: Create the main container component**

Create `src/app/(platform)/calculator/components/CalculatorPage.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Platform } from "../calculator.utils";
import { calculateMonthlyLoss, calculateYearlyLoss } from "../calculator.utils";
import { CalculatorForm } from "./CalculatorForm";
import { CalculatorResult } from "./CalculatorResult";

interface FormValues {
  revenue: number;
  aov: number;
  platform: Platform;
}

interface ResultData extends FormValues {
  monthlyLoss: number;
  yearlyLoss: number;
}

export function CalculatorPage() {
  const t = useTranslations("calculator");
  const [result, setResult] = useState<ResultData | null>(null);

  const handleCalculate = (values: FormValues) => {
    const monthlyLoss = calculateMonthlyLoss(values.revenue, values.platform);
    const yearlyLoss = calculateYearlyLoss(monthlyLoss);
    setResult({ ...values, monthlyLoss, yearlyLoss });
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
        <CalculatorForm onSubmit={handleCalculate} />
      </div>

      {result && (
        <CalculatorResult
          monthlyLoss={result.monthlyLoss}
          yearlyLoss={result.yearlyLoss}
          revenue={result.revenue}
          aov={result.aov}
          platform={result.platform}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the page route with metadata**

Create `src/app/(platform)/calculator/page.tsx`:

```typescript
import type { Metadata } from "next";
import { CalculatorPage } from "./components/CalculatorPage";

export const metadata: Metadata = {
  title: "How Much Are You Losing to Delivery Fees? | Plovr",
  description:
    "Calculate how much your restaurant loses to delivery platform fees every month.",
  openGraph: {
    title: "How Much Are You Losing to Delivery Fees?",
    description:
      "Calculate how much your restaurant loses to delivery platform fees every month.",
    type: "website",
  },
};

export default function CalculatorRoute() {
  return <CalculatorPage />;
}
```

- [ ] **Step 3: Add the fade-in animation to Tailwind config**

Check if `animate-fade-in` is already defined in `tailwind.config.ts`. If not, add it to the `extend.animation` and `extend.keyframes` section:

```typescript
// In tailwind.config.ts extend section:
keyframes: {
  'fade-in': {
    '0%': { opacity: '0', transform: 'translateY(20px)' },
    '100%': { opacity: '1', transform: 'translateY(0)' },
  },
},
animation: {
  'fade-in': 'fade-in 0.5s ease-out',
},
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(platform\)/calculator/components/CalculatorPage.tsx src/app/\(platform\)/calculator/page.tsx tailwind.config.ts
git commit -m "feat: add calculator page route and container component (#29)"
```

---

### Task 8: Integration Test + Final Verification

**Files:**
- Existing test and source files

- [ ] **Step 1: Run all calculator tests**

Run: `npx vitest run src/app/(platform)/calculator/ src/app/api/leads/`
Expected: All tests PASS.

- [ ] **Step 2: Run full test suite**

Run: `npm run test:run`
Expected: All existing tests still pass (no regressions).

- [ ] **Step 3: Run type check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: No errors.

- [ ] **Step 4: Commit any remaining fixes (if needed)**

If any fixes were required:
```bash
git add -A
git commit -m "fix: resolve test/lint issues for calculator page (#29)"
```
