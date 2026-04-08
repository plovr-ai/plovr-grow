# Customer Loss Hook Page - Design Spec

**Date**: 2026-04-08
**Issue**: #31
**Status**: Approved
**Depends on**: #29 (Calculator Hook Page — provides Lead model, /api/leads, LeadCaptureForm)

## Overview

A marketing conversion page that helps restaurants visualize how many repeat customers they're losing each month. The page collects basic order metrics, computes estimated customer churn and revenue impact, and guides users toward Plovr's direct ordering solution via the Website Generator.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| URL routing | `/customer-loss` (standalone, top-level) | Marketing page, no brand context needed |
| Route group | `(platform)` | Co-locate with `/calculator` and `/generator` |
| Interaction | Single page, animated transition | Minimize friction for conversion |
| Calculation | Client-side, hardcoded rates | Industry averages, no backend needed |
| Result display | Lost customers + monthly/yearly revenue loss | Customer-focused messaging |
| CTA flow | Email → Lead table (source: "customer-loss") → redirect `/generator` | Reuse #29 lead capture infrastructure |
| Lead model | Reuse #29's Lead model with `source` field | Unified lead data management |

## Page Structure

### Route & File Layout

```
src/app/(platform)/customer-loss/
  page.tsx                            — Server component (metadata + render)
  customer-loss.utils.ts              — Churn constants + calculation functions
  components/
    CustomerLossPage.tsx              — Main container, manages form ↔ result state
    CustomerLossForm.tsx              — Input form (monthly orders + AOV)
    CustomerLossResult.tsx            — Result display + chart + CTA
```

Reused from #29:
- `LeadCaptureForm` component (from calculator)
- `POST /api/leads` API route
- `Lead` Prisma model (with added `source` field)

### Form Inputs

| Field | Type | Default | Validation |
|-------|------|---------|------------|
| Monthly orders | Number input | Empty (required) | > 0 |
| Avg order value (AOV) | Number input | $25 | > 0 |

No platform selector — simpler than #29.

## Calculation Logic

### Constants

```typescript
const CHURN_RATE = 0.25;           // Industry average 25% monthly churn
const ORDERS_PER_CUSTOMER = 2;     // Single restaurant avg orders per customer per month
```

**Data sources:**
- Churn rate: Industry average 20-30%, using 25% midpoint
- Orders per customer: Based on industry data showing 3.8 chain visits/month across all restaurants, ~2 for a single restaurant

### Formula

```typescript
function calculateCustomerLoss(monthlyOrders: number, aov: number) {
  const estimatedCustomers = Math.round(monthlyOrders / ORDERS_PER_CUSTOMER);
  const lostCustomers = Math.round(estimatedCustomers * CHURN_RATE);
  const monthlyRevenueLoss = lostCustomers * aov * ORDERS_PER_CUSTOMER;
  const yearlyRevenueLoss = monthlyRevenueLoss * 12;
  return { estimatedCustomers, lostCustomers, monthlyRevenueLoss, yearlyRevenueLoss };
}
```

## Result Page UI

```
┌─────────────────────────────────────────┐
│  You're losing ~XX customers/month      │  ← Large red number, count-up animation
│  That's $X,XXX/month in lost revenue    │  ← Monthly revenue loss
│  $XX,XXX/year                           │  ← Yearly figure, secondary emphasis
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ Your customers:  ████████ 200   │    │  ← Bar chart comparison
│  │ Lost monthly:    ██       50    │    │     Red bar
│  └─────────────────────────────────┘    │
│                                         │
│  ✓ Loyalty programs retain customers    │  ← Selling points (retention focus)
│  ✓ Direct ordering builds relationships │
│                                         │
│  Stop losing customers                  │
│  [email@example.com] [Continue]         │  ← Lead capture → redirect /generator
└─────────────────────────────────────────┘
```

### Animation

- Form → Result: CSS transition (opacity + translateY), reuse #29's `animate-fade-in`
- Lost customers number: Count-up animation from 0 to target value
- Bar chart: Width grows from 0 to proportional size

## Data Model Changes

### Lead model `source` field (extends #29)

```prisma
model Lead {
  // ... existing fields from #29
  source    String   @default("calculator")  // "calculator" | "customer-loss"
  // ...
}
```

When submitting from this page, pass `source: "customer-loss"` to `/api/leads`.

The `/api/leads` Zod schema needs to accept an optional `source` field:
```typescript
source: z.enum(["calculator", "customer-loss"]).default("calculator"),
```

## Technical Details

### i18n

- Use `next-intl` for all UI copy
- Translation keys under `customerLoss` namespace in `messages/shared/en.json`
- Currency formatting via `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })`
- No hardcoded `$` symbols

### SEO

- Server component generates metadata (title, description, Open Graph tags)
- Title: "Restaurant Customer Loss Calculator — How Many Regulars Are You Losing? | Plovr"
- Description: "Most restaurants lose 20-30% of repeat customers monthly. Calculate your customer churn and revenue impact in seconds."
- Keywords optimized for: "calculator", "customer churn", "repeat customers"

### Responsive Design

- Mobile-first approach
- Form and result sections stack vertically on small screens
- Chart adapts to container width
