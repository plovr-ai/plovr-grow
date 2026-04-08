# Calculator Hook Page - Design Spec

**Date**: 2026-04-08
**Issue**: #29
**Status**: Approved

## Overview

A marketing conversion page that helps restaurants calculate how much they're losing to delivery platform fees. The page collects basic business metrics, computes estimated losses, and guides users toward Plovr's direct ordering solution via the Website Generator.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| URL routing | `/calculator` (standalone, top-level) | Marketing page, no brand context needed |
| Route group | `(platform)` | Co-locate with existing `/generator` |
| Interaction | Single page, animated transition | Minimize friction for conversion |
| Calculation | Client-side, hardcoded rates | Industry averages, no backend needed |
| Result display | Total monthly + yearly loss only | Keep it simple, no breakdown |
| CTA flow | Email → Lead table → redirect `/generator` | Capture lead data + seamless conversion |
| Lead table | Platform-level, no `tenantId` | Pre-tenant marketing data |
| Placeholder links | Not rendered | "Estimate lost customers" / "Preview your website" deferred |

## Page Structure

### Route & File Layout

```
src/app/(platform)/calculator/
  page.tsx                        — Server component (metadata + render)
  components/
    CalculatorPage.tsx            — Main container, manages form ↔ result state
    CalculatorForm.tsx            — Input form
    CalculatorResult.tsx          — Result display + chart + CTA
    LeadCaptureForm.tsx           — Email input + submit
```

### Form Inputs

| Field | Type | Default | Validation |
|-------|------|---------|------------|
| Monthly delivery revenue | Number input | Empty (required) | > 0 |
| Avg order value (AOV) | Number input | $25 | > 0 |
| Platform | Single select | DoorDash | DoorDash / Uber Eats / Both |

## Calculation Logic

### Platform Fee Constants

```typescript
const PLATFORM_FEES = {
  doordash: { commissionRate: 0.25, marketingFee: 0.03 },   // 28% total
  ubereats: { commissionRate: 0.28, marketingFee: 0.03 },   // 31% total
  both: { commissionRate: 0.265, marketingFee: 0.03 },      // 29.5% avg
} as const;
```

### Formula

```
totalMonthlyLoss = revenue × (commissionRate + marketingFee)
totalYearlyLoss = totalMonthlyLoss × 12
```

## Result Page UI

```
┌─────────────────────────────────────┐
│  You're losing $X,XXX/month         │  ← Large red number, count-up animation
│  That's $XX,XXX/year                │  ← Yearly figure, secondary emphasis
│                                     │
│  ┌───────────────────────────────┐  │
│  │ [Bar Chart]                   │  │  ← Platform vs Direct comparison
│  │  Platform: $████████████ $X   │  │
│  │  Direct:   $             $0   │  │     Direct fees shown as $0
│  └───────────────────────────────┘  │
│                                     │
│  ✓ Direct ordering - no fees        │  ← Selling points
│  ✓ Customer retention               │
│                                     │
│  Start saving today                 │
│  [email@example.com] [Continue]     │  ← Lead capture → redirect /generator
└─────────────────────────────────────┘
```

### Animation

- Form → Result: CSS transition (opacity + translateY)
- Loss number: Count-up animation from 0 to target value
- Bar chart: Width grows from 0 to proportional size

## Data Model

### New Prisma Model: Lead

```prisma
model Lead {
  id          String   @id @default(cuid())
  email       String
  revenue     Float
  aov         Float
  platform    String
  monthlyLoss Float   @map("monthly_loss")
  createdAt   DateTime @default(now()) @map("created_at")

  @@map("leads")
}
```

- No `tenantId` — platform-level marketing data
- No soft delete or audit fields needed

## API

### POST /api/leads

**Location**: `src/app/api/leads/route.ts`

**Request body** (validated with Zod):
```typescript
{
  email: string;       // valid email format
  revenue: number;     // > 0
  aov: number;         // > 0
  platform: string;    // "doordash" | "ubereats" | "both"
  monthlyLoss: number; // > 0
}
```

**Response**: `{ success: true }`

**Auth**: None (public endpoint)

**Flow**:
1. Validate input with Zod
2. Insert into `Lead` table via Prisma
3. Return success
4. Client redirects to `/generator`

## Technical Details

### i18n

- Use `next-intl` for all UI copy
- Translation keys under `calculator` namespace in `messages/shared/en.json`
- Currency formatting via `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })`
- No hardcoded `$` symbols

### SEO

- Server component generates metadata (title, description, Open Graph tags)
- Title: "How Much Are You Losing to Delivery Fees? | Plovr"
- Description: "Calculate how much your restaurant loses to delivery platform fees every month."

### Responsive Design

- Mobile-first approach
- Form and result sections stack vertically on small screens
- Chart adapts to container width
