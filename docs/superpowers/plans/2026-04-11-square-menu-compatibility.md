# Square Menu Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the Square Catalog menu compatibility gaps — support inclusive taxes end-to-end, map Square variations to injected modifier groups with correct semantics, extend `ExternalIdMapping` for variation reverse-lookup, and wire sync stats reporting.

**Architecture:** Three layered changes: (1) Prisma schema additions (`TaxConfig.inclusionType`, `ExternalIdMapping.externalVersion`, `IntegrationSyncRecord.stats`). (2) `src/lib/pricing.ts` refactor to the Square-standard "shared `taxableBase`" algorithm that supports any mix of additive/inclusive taxes on any item, plus downstream consumer wiring. (3) Extend `SquareCatalogService.mapToMenuModels` to resolve item_option names, sort by ordinal, set isDefault, map `inclusion_type`, filter `product_type`/`VARIABLE_PRICING`, flatten categories, resolve first image, and emit `CatalogSyncStats`.

**Tech Stack:** TypeScript, Next.js, Prisma, Vitest, Square SDK (already installed).

**Spec:** `docs/superpowers/specs/2026-04-11-square-menu-compatibility-design.md`

---

## File Structure

**Schema / types**
- Modify: `prisma/schema.prisma` — add fields to `TaxConfig`, `ExternalIdMapping`, `IntegrationSyncRecord`
- Modify: `src/services/menu/tax-config.types.ts` — export `TaxInclusionType`, extend `ItemTaxConfig`
- Modify: `src/services/integration/integration.types.ts` (or create if missing) — `CatalogSyncStats` type
- Modify: `src/services/square/square.types.ts` — `MappedTax.inclusionType`, `MappedMenuItem.taxExternalIds`

**Repositories / services**
- Modify: `src/repositories/tax-config.repository.ts` — read/write `inclusionType`
- Modify: `src/services/menu/tax-config.service.ts` — expose `inclusionType` in DTOs
- Modify: `src/services/integration/integration.service.ts` — `recordSync(..., stats?)`

**Pricing core**
- Modify: `src/lib/pricing.ts` — new algorithm, extended `ItemTaxConfig` / `PricingResult`
- Modify: `src/lib/__tests__/pricing.test.ts` — new test cases for multi-tax

**Pricing consumers**
- Modify: `src/services/order/order.service.ts`
- Modify: `src/services/catering/catering-order.service.ts`
- Modify: `src/hooks/usePricing.ts` (and sibling files — follow grep results)
- Modify: `src/hooks/__tests__/usePricing.test.ts`
- Modify: `src/app/(storefront)/r/[merchantSlug]/checkout/page.tsx`
- Modify: `src/app/(storefront)/components/checkout/PriceSummary.tsx`
- Modify: `src/app/(storefront)/components/checkout/__tests__/PriceSummary.test.tsx`

**Square catalog mapping**
- Modify: `src/services/square/square-catalog.service.ts` — extend `mapToMenuModels`
- Modify: `src/services/square/__tests__/square-catalog.test.ts` — add coverage per spec test plan

---

## Task 1: Prisma schema migration

**Files:**
- Modify: `prisma/schema.prisma`
- Generate: new Prisma migration file under `prisma/migrations/`

- [ ] **Step 1: Add `inclusionType` to `TaxConfig` model**

Locate the `TaxConfig` model (around line 275) and add the field:

```prisma
model TaxConfig {
  id               String            @id
  tenantId         String            @map("tenant_id")
  name             String
  description      String?           @db.Text
  roundingMethod   String            @default("half_up") @map("rounding_method")
  inclusionType    String            @default("additive") @map("inclusion_type")  // NEW
  status           String            @default("active")
  deleted          Boolean           @default(false)
  createdAt        DateTime          @default(now()) @map("created_at")
  updatedAt        DateTime          @updatedAt @map("updated_at")
  tenant           Tenant            @relation(fields: [tenantId], references: [id])
  merchantTaxRates MerchantTaxRate[]
  menuItemTaxes    MenuItemTax[]

  @@index([tenantId])
  @@index([tenantId, status])
  @@map("tax_configs")
}
```

- [ ] **Step 2: Add `externalVersion` to `ExternalIdMapping`**

Locate `ExternalIdMapping` (search for `model ExternalIdMapping`) and add:

```prisma
  externalVersion BigInt?  @map("external_version")
```

Place it after `externalId` and before `deleted`.

- [ ] **Step 3: Add `stats` to `IntegrationSyncRecord`**

Locate `IntegrationSyncRecord` and add a nullable JSON stats field:

```prisma
  stats          Json?    @map("stats")
```

Place it after `errorMessage` and before `startedAt`.

- [ ] **Step 4: Run Prisma generate and create migration**

```bash
npm run db:generate
npx prisma migrate dev --name square_menu_compat
```

Expected: migration file created, Prisma client regenerated, no errors.

- [ ] **Step 5: Verify the generated migration SQL**

Read the new file under `prisma/migrations/*_square_menu_compat/migration.sql` and confirm three `ALTER TABLE` statements:
- `tax_configs ADD COLUMN inclusion_type VARCHAR NOT NULL DEFAULT 'additive'`
- `external_id_mappings ADD COLUMN external_version BIGINT NULL`
- `integration_sync_records ADD COLUMN stats JSON NULL`

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add tax inclusionType and Square sync metadata fields"
```

---

## Task 2: `TaxInclusionType` type + repository read/write

**Files:**
- Modify: `src/services/menu/tax-config.types.ts`
- Modify: `src/repositories/tax-config.repository.ts`
- Modify: `src/repositories/__tests__/tax-config.repository.test.ts`

- [ ] **Step 1: Read the existing tax-config types file**

Run: `cat src/services/menu/tax-config.types.ts`

Note the existing exported types — you'll add `TaxInclusionType` without breaking them.

- [ ] **Step 2: Export `TaxInclusionType` and extend `ItemTaxInfo`**

Add near the top of `src/services/menu/tax-config.types.ts`:

```typescript
export type TaxInclusionType = "additive" | "inclusive";
```

Find the existing `ItemTaxInfo` interface and add `inclusionType: TaxInclusionType`. If the interface is re-exported from a DTO that comes from the repository, also update the DTO type.

- [ ] **Step 3: Write failing test for repository read**

Add to `src/repositories/__tests__/tax-config.repository.test.ts`:

```typescript
it("returns inclusionType from DB row", async () => {
  const tenantId = "t-1";
  const config = await taxConfigRepository.create({
    tenantId,
    name: "VAT",
    inclusionType: "inclusive",
    roundingMethod: "half_up",
  });
  const loaded = await taxConfigRepository.getById(tenantId, config.id);
  expect(loaded?.inclusionType).toBe("inclusive");
});
```

- [ ] **Step 4: Run the test to see it fail**

```bash
npm run test:run -- tax-config.repository
```

Expected: fail with type error on `inclusionType` or runtime mismatch.

- [ ] **Step 5: Update repository to read/write the field**

In `src/repositories/tax-config.repository.ts`, find the `create` / `update` / mapping helpers. Add `inclusionType` to:
- `create` input type and Prisma `data`
- `update` input type and Prisma `data`
- the row → DTO mapper (default `"additive"` if null for pre-migration safety)

- [ ] **Step 6: Re-run the test**

```bash
npm run test:run -- tax-config.repository
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/services/menu/tax-config.types.ts src/repositories/tax-config.repository.ts src/repositories/__tests__/tax-config.repository.test.ts
git commit -m "feat(tax): add inclusionType field to TaxConfig repository"
```

---

## Task 3: `TaxConfigService` surfaces `inclusionType`

**Files:**
- Modify: `src/services/menu/tax-config.service.ts`
- Modify: `src/services/menu/__tests__/tax-config.service.test.ts`

- [ ] **Step 1: Write failing test**

Add to the service test file:

```typescript
it("returns inclusionType in getById", async () => {
  // Arrange: seed a TaxConfig with inclusionType="inclusive" via repo
  const cfg = await taxConfigService.create("t-1", {
    name: "VAT 10%",
    inclusionType: "inclusive",
    roundingMethod: "half_up",
  });
  const result = await taxConfigService.getById("t-1", cfg.id);
  expect(result?.inclusionType).toBe("inclusive");
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
npm run test:run -- tax-config.service
```

Expected: fail — create input or return DTO missing field.

- [ ] **Step 3: Update service DTOs and methods**

In `src/services/menu/tax-config.service.ts`:
- Add `inclusionType?: TaxInclusionType` to `CreateTaxConfigInput` / `UpdateTaxConfigInput` (default `"additive"` when creating)
- Include `inclusionType` in all returned DTOs (list/getById/create/update)

- [ ] **Step 4: Re-run test**

```bash
npm run test:run -- tax-config.service
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/menu/tax-config.service.ts src/services/menu/__tests__/tax-config.service.test.ts
git commit -m "feat(tax): expose inclusionType via TaxConfigService"
```

---

## Task 4: `pricing.ts` — extend types

**Files:**
- Modify: `src/lib/pricing.ts`

- [ ] **Step 1: Extend `ItemTaxConfig`**

Edit `src/lib/pricing.ts` and replace `ItemTaxConfig`:

```typescript
import type {
  RoundingMethod,
  TaxInclusionType,
} from "@/services/menu/tax-config.types";

export interface ItemTaxConfig {
  rate: number;
  roundingMethod: RoundingMethod;
  inclusionType: TaxInclusionType;
}
```

- [ ] **Step 2: Extend `PricingResult`**

Replace `PricingResult`:

```typescript
export interface PricingResult {
  subtotal: number;
  taxAmount: number;           // total = additive + inclusive (for audit)
  taxAmountAdditive: number;   // new: added to total
  taxAmountInclusive: number;  // new: already in subtotal, UI "(included)"
  feesAmount: number;
  feesBreakdown: FeeBreakdownItem[];
  tipAmount: number;
  totalAmount: number;
}
```

- [ ] **Step 3: Verify type check still compiles before writing tests**

Run: `npx tsc --noEmit`

Expected: errors in the consumers of `ItemTaxConfig` and `PricingResult` (they'll be fixed in later tasks). The pricing.ts file itself must compile; fix any internal issues now (the algorithm body will be updated in Task 5 — for this step leave the old algorithm but add `taxAmountAdditive: totalTaxAmount, taxAmountInclusive: 0` to the return so the file compiles).

- [ ] **Step 4: Commit**

```bash
git add src/lib/pricing.ts
git commit -m "feat(pricing): extend ItemTaxConfig and PricingResult with inclusion fields"
```

---

## Task 5: `pricing.ts` — shared `taxableBase` algorithm (TDD)

**Files:**
- Modify: `src/lib/__tests__/pricing.test.ts`
- Modify: `src/lib/pricing.ts`

- [ ] **Step 1: Write failing tests for multi-additive (regression)**

Append to `src/lib/__tests__/pricing.test.ts`:

```typescript
describe("calculateOrderPricing - multi additive tax", () => {
  it("sums multiple additive taxes with shared base", () => {
    const result = calculateOrderPricing([
      {
        itemId: "a",
        unitPrice: 100,
        quantity: 1,
        taxes: [
          { rate: 0.06,  roundingMethod: "half_up", inclusionType: "additive" },
          { rate: 0.01,  roundingMethod: "half_up", inclusionType: "additive" },
          { rate: 0.005, roundingMethod: "half_up", inclusionType: "additive" },
        ],
      },
    ]);
    expect(result.subtotal).toBe(100);
    expect(result.taxAmountAdditive).toBeCloseTo(7.5, 2); // 6 + 1 + 0.5
    expect(result.taxAmountInclusive).toBe(0);
    expect(result.totalAmount).toBeCloseTo(107.5, 2);
  });
});
```

- [ ] **Step 2: Write failing tests for single inclusive tax**

```typescript
describe("calculateOrderPricing - inclusive tax", () => {
  it("reverses lineTotal for single inclusive tax", () => {
    // VAT 10%, listed price 110 → base 100, tax 10
    const result = calculateOrderPricing([
      {
        itemId: "a",
        unitPrice: 110,
        quantity: 1,
        taxes: [
          { rate: 0.10, roundingMethod: "half_up", inclusionType: "inclusive" },
        ],
      },
    ]);
    expect(result.subtotal).toBe(110);
    expect(result.taxAmountInclusive).toBeCloseTo(10, 2);
    expect(result.taxAmountAdditive).toBe(0);
    expect(result.totalAmount).toBeCloseTo(110, 2);
  });

  it("handles multiple inclusive taxes with shared base", () => {
    // VAT 10% + eco 2%, listed 112 → base 100, vat 10, eco 2
    const result = calculateOrderPricing([
      {
        itemId: "a",
        unitPrice: 112,
        quantity: 1,
        taxes: [
          { rate: 0.10, roundingMethod: "half_up", inclusionType: "inclusive" },
          { rate: 0.02, roundingMethod: "half_up", inclusionType: "inclusive" },
        ],
      },
    ]);
    expect(result.taxAmountInclusive).toBeCloseTo(12, 2);
    expect(result.totalAmount).toBeCloseTo(112, 2);
  });
});
```

- [ ] **Step 3: Write failing tests for mixed additive + inclusive on same item**

```typescript
describe("calculateOrderPricing - mixed additive + inclusive same item", () => {
  it("inclusive reverses lineTotal, additive applies to derived base", () => {
    // Listed 110, VAT 10% inclusive (base 100), service tax 5% additive
    // Expected: subtotal 110, inclusive tax 10, additive tax 5, total = 110 + 5 = 115
    const result = calculateOrderPricing([
      {
        itemId: "a",
        unitPrice: 110,
        quantity: 1,
        taxes: [
          { rate: 0.10, roundingMethod: "half_up", inclusionType: "inclusive" },
          { rate: 0.05, roundingMethod: "half_up", inclusionType: "additive" },
        ],
      },
    ]);
    expect(result.subtotal).toBe(110);
    expect(result.taxAmountInclusive).toBeCloseTo(10, 2);
    expect(result.taxAmountAdditive).toBeCloseTo(5, 2);
    expect(result.taxAmount).toBeCloseTo(15, 2);
    expect(result.totalAmount).toBeCloseTo(115, 2);
  });
});
```

- [ ] **Step 4: Write failing tests for cross-item mix**

```typescript
describe("calculateOrderPricing - cross-item mix", () => {
  it("handles one additive item and one inclusive item", () => {
    const result = calculateOrderPricing([
      {
        itemId: "a",
        unitPrice: 100,
        quantity: 1,
        taxes: [
          { rate: 0.07, roundingMethod: "half_up", inclusionType: "additive" },
        ],
      },
      {
        itemId: "b",
        unitPrice: 110,
        quantity: 1,
        taxes: [
          { rate: 0.10, roundingMethod: "half_up", inclusionType: "inclusive" },
        ],
      },
    ]);
    expect(result.subtotal).toBe(210);
    expect(result.taxAmountAdditive).toBeCloseTo(7, 2);
    expect(result.taxAmountInclusive).toBeCloseTo(10, 2);
    expect(result.totalAmount).toBeCloseTo(217, 2); // 210 + 7
  });
});
```

- [ ] **Step 5: Write failing test for 0% rate + zero-tax skip**

```typescript
it("skips taxes with rate <= 0", () => {
  const result = calculateOrderPricing([
    {
      itemId: "a",
      unitPrice: 50,
      quantity: 2,
      taxes: [
        { rate: 0,   roundingMethod: "half_up", inclusionType: "additive" },
        { rate: 0.1, roundingMethod: "half_up", inclusionType: "additive" },
      ],
    },
  ]);
  expect(result.taxAmountAdditive).toBeCloseTo(10, 2);
});
```

- [ ] **Step 6: Run tests and verify they fail**

```bash
npm run test:run -- src/lib/__tests__/pricing.test.ts
```

Expected: the new `describe` blocks fail; existing tests still pass (or may need `inclusionType: "additive"` added to fixtures — do that next).

- [ ] **Step 7: Update existing test fixtures to carry `inclusionType`**

Grep for `ItemTaxConfig` / `roundingMethod` in `pricing.test.ts`. Every existing test fixture that supplies `taxes:` needs `inclusionType: "additive"` added. Run again to confirm existing tests are still green after the fixture update.

- [ ] **Step 8: Replace the tax-calc block in `calculateOrderPricing`**

In `src/lib/pricing.ts`, replace the tax loop in `calculateOrderPricing`:

```typescript
let taxAmountAdditive = 0;
let taxAmountInclusive = 0;
for (const item of items) {
  const lineTotal = item.unitPrice * item.quantity;
  const taxes = (item.taxes || []).filter((t) => t.rate > 0);

  const sumInclusiveRate = taxes
    .filter((t) => t.inclusionType === "inclusive")
    .reduce((acc, t) => acc + t.rate, 0);
  const taxableBase =
    sumInclusiveRate > 0 ? lineTotal / (1 + sumInclusiveRate) : lineTotal;

  for (const tax of taxes) {
    const rawTax = taxableBase * tax.rate;
    const rounded = applyRounding(rawTax, tax.roundingMethod);
    if (tax.inclusionType === "inclusive") {
      taxAmountInclusive += rounded;
    } else {
      taxAmountAdditive += rounded;
    }
  }
}
taxAmountAdditive = roundPrice(taxAmountAdditive);
taxAmountInclusive = roundPrice(taxAmountInclusive);
const totalTaxAmount = roundPrice(taxAmountAdditive + taxAmountInclusive);
```

Update the return block:

```typescript
const totalAmount = roundPrice(
  roundedSubtotal + taxAmountAdditive + feesAmount + tipAmount
);

return {
  subtotal: roundedSubtotal,
  taxAmount: totalTaxAmount,
  taxAmountAdditive,
  taxAmountInclusive,
  feesAmount,
  feesBreakdown,
  tipAmount,
  totalAmount,
};
```

- [ ] **Step 9: Run the full pricing test suite**

```bash
npm run test:run -- src/lib/__tests__/pricing.test.ts
```

Expected: all green.

- [ ] **Step 10: Commit**

```bash
git add src/lib/pricing.ts src/lib/__tests__/pricing.test.ts
git commit -m "feat(pricing): support inclusive taxes with shared taxableBase algorithm"
```

---

## Task 6: Propagate `inclusionType` through downstream pricing callers

**Files:** (discover exact list via `grep`)
- Modify: `src/services/order/order.service.ts`
- Modify: `src/services/catering/catering-order.service.ts`
- Modify: `src/hooks/usePricing.ts` (and any sibling hooks that build `ItemTaxConfig`)
- Modify: `src/hooks/__tests__/usePricing.test.ts`
- Modify: `src/app/(storefront)/r/[merchantSlug]/checkout/page.tsx`

- [ ] **Step 1: Enumerate all construction sites of `ItemTaxConfig`**

```bash
grep -rn "ItemTaxConfig\|rate:.*roundingMethod\|roundingMethod:.*rate" src --include="*.ts" --include="*.tsx"
```

Write the list down. These are all the places that must now also pass `inclusionType`.

- [ ] **Step 2: Run `npx tsc --noEmit` to see the TypeScript error list**

Every site that constructs `ItemTaxConfig` should now fail type-check because `inclusionType` is required. This is your exhaustive to-fix list.

```bash
npx tsc --noEmit 2>&1 | grep -A2 "inclusionType"
```

- [ ] **Step 3: Fix each call site**

At each call site, read the surrounding context to find where the source `TaxConfig` (from repository) is available. The mapping is always:

```typescript
{
  rate: merchantTaxRate.rate,
  roundingMethod: taxConfig.roundingMethod,
  inclusionType: taxConfig.inclusionType,  // NEW
}
```

Where the call site does not have a `TaxConfig` loaded (e.g. uses a hardcoded DTO in tests), default to `"additive"`.

- [ ] **Step 4: Update hook unit tests**

In `src/hooks/__tests__/usePricing.test.ts`, any fixture that builds an `ItemTaxConfig` needs `inclusionType: "additive"` added. Run:

```bash
npm run test:run -- src/hooks/__tests__/usePricing.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run full type check**

```bash
npx tsc --noEmit
```

Expected: no errors (or unrelated pre-existing errors only).

- [ ] **Step 6: Run the full test suite**

```bash
npm run test:run
```

Fix any regressions introduced by missed call sites.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(pricing): pass inclusionType through all ItemTaxConfig call sites"
```

---

## Task 7: `PriceSummary` UI shows "(included)" for inclusive tax

**Files:**
- Modify: `src/app/(storefront)/components/checkout/PriceSummary.tsx`
- Modify: `src/app/(storefront)/components/checkout/__tests__/PriceSummary.test.tsx`

- [ ] **Step 1: Read the current component**

Run: `cat src/app/(storefront)/components/checkout/PriceSummary.tsx`

Identify where the tax line is rendered (uses `taxAmount`) and where `totalAmount` is shown.

- [ ] **Step 2: Write failing test for inclusive display**

Append to the PriceSummary test file:

```typescript
it("renders inclusive tax as '(included)' and excludes from total", () => {
  const { getByText } = render(
    <PriceSummary
      subtotal={110}
      taxAmount={10}
      taxAmountAdditive={0}
      taxAmountInclusive={10}
      feesAmount={0}
      feesBreakdown={[]}
      tipAmount={0}
      totalAmount={110}
    />
  );
  expect(getByText(/included/i)).toBeInTheDocument();
  expect(getByText("$110.00")).toBeInTheDocument(); // total matches subtotal
});

it("renders additive tax as normal line added to total", () => {
  const { getByText } = render(
    <PriceSummary
      subtotal={100}
      taxAmount={7}
      taxAmountAdditive={7}
      taxAmountInclusive={0}
      feesAmount={0}
      feesBreakdown={[]}
      tipAmount={0}
      totalAmount={107}
    />
  );
  expect(getByText("$7.00")).toBeInTheDocument();
  expect(getByText("$107.00")).toBeInTheDocument();
});
```

- [ ] **Step 3: Run the test, confirm failure**

```bash
npm run test:run -- PriceSummary
```

Expected: fail — props missing / "(included)" not rendered.

- [ ] **Step 4: Extend `PriceSummary` props and JSX**

Extend the component's props interface:

```typescript
interface PriceSummaryProps {
  subtotal: number;
  taxAmount: number;
  taxAmountAdditive: number;
  taxAmountInclusive: number;
  feesAmount: number;
  feesBreakdown: FeeBreakdownItem[];
  tipAmount: number;
  totalAmount: number;
}
```

Render logic (pseudocode, adapt to existing JSX style — use `useTranslations()` for labels per project i18n rules):

```tsx
{taxAmountInclusive > 0 && (
  <Row label={`${t("tax")} ${t("included")}`} value={formatPrice(taxAmountInclusive)} muted />
)}
{taxAmountAdditive > 0 && (
  <Row label={t("tax")} value={formatPrice(taxAmountAdditive)} />
)}
```

If the translation keys `included` does not yet exist, add it to `src/i18n/messages/shared/en.json` (and any other active locales — grep for the existing `tax` key to find them).

- [ ] **Step 5: Update all call sites that render `PriceSummary`**

```bash
grep -rn "PriceSummary" src --include="*.tsx" --include="*.ts"
```

Pass the two new props (`taxAmountAdditive`, `taxAmountInclusive`) from `PricingResult` at every call site.

- [ ] **Step 6: Run the PriceSummary test and full checkout tests**

```bash
npm run test:run -- PriceSummary checkout
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/\(storefront\)/components/checkout/ src/i18n/messages/
git commit -m "feat(checkout): show inclusive tax as included line in PriceSummary"
```

---

## Task 8: `CatalogSyncStats` type + `recordSync` extension

**Files:**
- Modify: `src/services/integration/integration.types.ts` (create if it doesn't exist)
- Modify: `src/services/integration/integration.service.ts`

- [ ] **Step 1: Locate existing integration service files**

```bash
ls src/services/integration/ 2>/dev/null || find src -path "*integration*" -name "*.ts" | head
```

If `integration.types.ts` doesn't exist, find the types file next to `integration.service.ts` — the project convention is `<name>.types.ts` alongside the service.

- [ ] **Step 2: Add `CatalogSyncStats` type**

Add to the integration types file:

```typescript
export interface CatalogSyncStats {
  itemsCreated: number;
  itemsUpdated: number;
  itemsSkipped: number;
  variationsAsOptions: number;
  modifierListsFlattened: number;
  categoriesFlattened: number;
  locationOverridesDropped: number;
  imagesDropped: number;
  taxesInclusive: number;
  taxesAdditive: number;
  discountsSkipped: number;
  pricingRulesSkipped: number;
  warnings: string[];
}

export function createEmptyCatalogSyncStats(): CatalogSyncStats {
  return {
    itemsCreated: 0,
    itemsUpdated: 0,
    itemsSkipped: 0,
    variationsAsOptions: 0,
    modifierListsFlattened: 0,
    categoriesFlattened: 0,
    locationOverridesDropped: 0,
    imagesDropped: 0,
    taxesInclusive: 0,
    taxesAdditive: 0,
    discountsSkipped: 0,
    pricingRulesSkipped: 0,
    warnings: [],
  };
}
```

- [ ] **Step 3: Extend `recordSync` signature**

In `integration.service.ts`, find `recordSync` and add a third optional argument:

```typescript
async recordSync(
  connectionId: string,
  update: { status: string; errorMessage?: string; finishedAt?: Date; objectsSynced?: number; objectsMapped?: number },
  stats?: CatalogSyncStats
): Promise<IntegrationSyncRecord>
```

In the Prisma call, include `stats: stats ?? undefined` (truncate `stats.warnings` to the first 100 entries before passing).

- [ ] **Step 4: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/services/integration/
git commit -m "feat(integration): add CatalogSyncStats and extend recordSync"
```

---

## Task 9: Extend `square.types.ts` — MappedTax.inclusionType, MappedMenuItem.taxExternalIds, MappedModifier fields

**Files:**
- Modify: `src/services/square/square-catalog.service.ts` (types are inline here) or `src/services/square/square.types.ts`

- [ ] **Step 1: Extend `MappedTax`**

In `src/services/square/square-catalog.service.ts`:

```typescript
import type { TaxInclusionType } from "@/services/menu/tax-config.types";

export interface MappedTax {
  externalId: string;
  name: string;
  percentage: number;
  inclusionType: TaxInclusionType;
}
```

- [ ] **Step 2: Extend `MappedMenuItem` with tax linkage and imageUrl**

```typescript
export interface MappedMenuItem {
  externalId: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;          // NEW
  categoryExternalIds: string[];
  taxExternalIds: string[];         // NEW — links to MappedTax.externalId
  modifiers: MappedModifiers | null;
  variationMappings: { externalId: string; name: string; groupId?: string; optionId?: string }[];
}
```

`groupId` / `optionId` are set only when the variation was mapped into an injected modifier group (multi-variation path).

- [ ] **Step 3: Extend `MappedModifierGroup` option with `isDefault` + `ordinal`**

```typescript
export interface MappedModifierOption {
  name: string;
  price: number;
  externalId: string;
  isDefault: boolean;
  ordinal: number;
}

export interface MappedModifierGroup {
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: MappedModifierOption[];
}
```

- [ ] **Step 4: Add `MappedCatalog.images` map (for first-image resolution)**

Not strictly required — alternative is to fetch images inside `mapToMenuModels`. Pick the simpler route: extend `SquareCatalogResult` to include `images`:

```typescript
export interface SquareCatalogResult {
  categories: CatalogObject[];
  items: CatalogObject[];
  modifierLists: CatalogObject[];
  taxes: CatalogObject[];
  images: CatalogObject[];   // NEW
}
```

And in `fetchFullCatalog`, add:

```typescript
images: allObjects.filter((o) => o.type === "IMAGE"),
```

- [ ] **Step 5: Type check**

```bash
npx tsc --noEmit
```

Existing callers of `MappedTax` / `MappedMenuItem` will break — fix them inline or leave broken until Task 13 (wiring). For now temporarily default `inclusionType: "additive"` where legacy mapper constructs `MappedTax` so the file compiles.

- [ ] **Step 6: Commit**

```bash
git add src/services/square/square-catalog.service.ts
git commit -m "refactor(square): extend mapping types for tax inclusion and variation linkage"
```

---

## Task 10: `mapToMenuModels` — variation → modifier group (TDD)

**Files:**
- Modify: `src/services/square/square-catalog.service.ts`
- Modify: `src/services/square/__tests__/square-catalog.test.ts`

- [ ] **Step 1: Read existing tests for context**

```bash
cat src/services/square/__tests__/square-catalog.test.ts
```

Note the fixture helpers for building `CatalogObject`.

- [ ] **Step 2: Write failing test — single variation item**

```typescript
describe("mapToMenuModels - single variation", () => {
  it("maps 1:1 without injecting a modifier group", () => {
    const catalog: SquareCatalogResult = {
      categories: [],
      modifierLists: [],
      taxes: [],
      images: [],
      items: [buildItem("item-1", "Latte", [
        buildVariation("var-1", "Regular", 500, 0),
      ])],
    };
    const result = squareCatalogService.mapToMenuModels(catalog);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].price).toBe(5.0);
    expect(result.items[0].modifiers).toBeNull();
    expect(result.items[0].variationMappings).toEqual([
      { externalId: "var-1", name: "Regular" },
    ]);
  });
});
```

Add fixture helpers near the top of the test file:

```typescript
function buildVariation(id: string, name: string, amountCents: number, ordinal: number): CatalogObject {
  return {
    type: "ITEM_VARIATION",
    id,
    itemVariationData: {
      name,
      ordinal,
      pricingType: "FIXED_PRICING",
      priceMoney: { amount: BigInt(amountCents), currency: "USD" },
    },
  } as CatalogObject;
}

function buildItem(id: string, name: string, variations: CatalogObject[], extra: Partial<any> = {}): CatalogObject {
  return {
    type: "ITEM",
    id,
    itemData: {
      name,
      productType: "REGULAR",
      variations,
      ...extra,
    },
  } as CatalogObject;
}
```

- [ ] **Step 3: Write failing test — multi-variation injects size group**

```typescript
it("injects single-select required group for multi-variation item", () => {
  const catalog: SquareCatalogResult = {
    categories: [],
    modifierLists: [],
    taxes: [],
    images: [],
    items: [buildItem("item-1", "Coffee", [
      buildVariation("v-s", "Small",  300, 0),
      buildVariation("v-m", "Medium", 400, 1),
      buildVariation("v-l", "Large",  500, 2),
    ])],
  };
  const result = squareCatalogService.mapToMenuModels(catalog);
  expect(result.items[0].price).toBe(3.0);
  expect(result.items[0].modifiers?.groups).toHaveLength(1);
  const group = result.items[0].modifiers!.groups[0];
  expect(group.name).toBe("Options");
  expect(group.required).toBe(true);
  expect(group.minSelect).toBe(1);
  expect(group.maxSelect).toBe(1);
  expect(group.options.map((o) => [o.name, o.price, o.isDefault])).toEqual([
    ["Small",  0, true],
    ["Medium", 1, false],
    ["Large",  2, false],
  ]);
});
```

- [ ] **Step 4: Write failing test — ordinal sort**

```typescript
it("sorts variations by ordinal regardless of array order", () => {
  const catalog: SquareCatalogResult = {
    categories: [], modifierLists: [], taxes: [], images: [],
    items: [buildItem("item-1", "Coffee", [
      buildVariation("v-l", "Large",  500, 2),
      buildVariation("v-s", "Small",  300, 0),
      buildVariation("v-m", "Medium", 400, 1),
    ])],
  };
  const result = squareCatalogService.mapToMenuModels(catalog);
  const names = result.items[0].modifiers!.groups[0].options.map((o) => o.name);
  expect(names).toEqual(["Small", "Medium", "Large"]);
  expect(result.items[0].price).toBe(3.0); // base = min price, not first-by-order
});
```

- [ ] **Step 5: Write failing test — variation mapping carries groupId/optionId for multi-variation**

```typescript
it("stores groupId/optionId on variationMappings for multi-variation item", () => {
  const catalog: SquareCatalogResult = {
    categories: [], modifierLists: [], taxes: [], images: [],
    items: [buildItem("item-1", "Coffee", [
      buildVariation("v-s", "Small", 300, 0),
      buildVariation("v-l", "Large", 500, 1),
    ])],
  };
  const result = squareCatalogService.mapToMenuModels(catalog);
  expect(result.items[0].variationMappings).toHaveLength(2);
  for (const m of result.items[0].variationMappings) {
    expect(m.groupId).toBeDefined();
    expect(m.optionId).toBeDefined();
  }
});
```

- [ ] **Step 6: Run failing tests**

```bash
npm run test:run -- square-catalog
```

Expected: all new tests fail (current implementation hardcodes group name to "Size", doesn't sort by ordinal, doesn't set isDefault, doesn't populate groupId/optionId).

- [ ] **Step 7: Refactor `mapToMenuModels` variation path**

In `src/services/square/square-catalog.service.ts`, replace the multi-variation block:

```typescript
// Sort variations by ordinal (stable, fall back to array order)
const sortedVariations = [...variations].sort((a, b) => {
  const ao = a.itemVariationData?.ordinal ?? 0;
  const bo = b.itemVariationData?.ordinal ?? 0;
  return ao - bo;
});

// Base price = minimum variation price (after VARIABLE_PRICING filter — Task 13)
const variationPrices = sortedVariations.map((v) =>
  this.moneyToNumber(v.itemVariationData?.priceMoney?.amount)
);
const basePrice = variationPrices.length > 0 ? Math.min(...variationPrices) : 0;

const groups: MappedModifierGroup[] = [];
const variationMappings: MappedMenuItem["variationMappings"] = [];

if (sortedVariations.length > 1) {
  const groupId = randomUUID();
  const options: MappedModifierOption[] = sortedVariations.map((v, idx) => {
    const price = variationPrices[idx];
    const optionId = randomUUID();
    const name = this.resolveVariationOptionName(v);
    const isDefault = price === basePrice && !options.some((o) => o.isDefault);
    // Note: checking options.some inside .map is O(n²) but variations are small;
    // if needed, use a flag instead.
    variationMappings.push({
      externalId: v.id,
      name,
      groupId,
      optionId,
    });
    return {
      name,
      price: Math.round((price - basePrice) * 100) / 100,
      externalId: v.id,
      isDefault,
      ordinal: v.itemVariationData?.ordinal ?? idx,
    };
  });

  // Fix isDefault: mark only the first option whose price === basePrice
  const defaultIdx = options.findIndex((o) => o.price === 0);
  options.forEach((o, i) => (o.isDefault = i === defaultIdx));

  groups.push({
    name: this.resolveVariationGroupName(sortedVariations),
    required: true,
    minSelect: 1,
    maxSelect: 1,
    options,
  });
} else if (sortedVariations.length === 1) {
  const v = sortedVariations[0];
  variationMappings.push({ externalId: v.id, name: v.itemVariationData?.name ?? "Default" });
}
```

Add helper methods:

```typescript
private resolveVariationGroupName(variations: (CatalogObject & { type: "ITEM_VARIATION" })[]): string {
  // Phase 1: if we have no access to CatalogItemOption objects, default to "Options".
  // Future: look up item_option_values → CatalogItemOption and use its name.
  // TODO(Phase 2): resolve CatalogItemOption names via a separate fetch.
  return "Options";
}

private resolveVariationOptionName(v: CatalogObject & { type: "ITEM_VARIATION" }): string {
  return v.itemVariationData?.name ?? "Default";
}
```

Import `randomUUID`:

```typescript
import { randomUUID } from "node:crypto";
```

- [ ] **Step 8: Run tests**

```bash
npm run test:run -- square-catalog
```

Expected: variation-related tests pass. Other existing tests may break — fix them by updating fixtures to include `images: []` and any new required fields.

- [ ] **Step 9: Commit**

```bash
git add src/services/square/square-catalog.service.ts src/services/square/__tests__/square-catalog.test.ts
git commit -m "feat(square): map variations to injected modifier group with ordinal and isDefault"
```

---

## Task 11: `mapToMenuModels` — ModifierList → group (TDD)

**Files:**
- Modify: `src/services/square/square-catalog.service.ts`
- Modify: `src/services/square/__tests__/square-catalog.test.ts`

- [ ] **Step 1: Fixture helpers for modifier lists**

Add to test file:

```typescript
function buildModifier(id: string, name: string, amountCents: number, ordinal: number): CatalogObject {
  return {
    type: "MODIFIER",
    id,
    modifierData: {
      name,
      ordinal,
      priceMoney: { amount: BigInt(amountCents), currency: "USD" },
    },
  } as CatalogObject;
}

function buildModifierList(
  id: string,
  name: string,
  selectionType: "SINGLE" | "MULTIPLE",
  minSelected: number,
  maxSelected: number | null,
  modifiers: CatalogObject[]
): CatalogObject {
  return {
    type: "MODIFIER_LIST",
    id,
    modifierListData: {
      name,
      selectionType,
      minSelectedModifiers: minSelected,
      maxSelectedModifiers: maxSelected,
      modifiers,
    },
  } as CatalogObject;
}
```

- [ ] **Step 2: Write failing test — SINGLE required**

```typescript
it("maps SINGLE selection_type + min=1 to required single-select group", () => {
  const ml = buildModifierList("ml-1", "Sauce", "SINGLE", 1, 1, [
    buildModifier("mod-1", "Ketchup",  0,   0),
    buildModifier("mod-2", "Mustard", 50,   1),
  ]);
  const item = buildItem("item-1", "Burger", [buildVariation("v-1", "Regular", 500, 0)], {
    modifierListInfo: [{ modifierListId: "ml-1", enabled: true }],
  });
  const result = squareCatalogService.mapToMenuModels({
    categories: [], modifierLists: [ml], taxes: [], images: [], items: [item],
  });
  const groups = result.items[0].modifiers!.groups;
  expect(groups).toHaveLength(1);
  expect(groups[0]).toMatchObject({
    name: "Sauce",
    required: true,
    minSelect: 1,
    maxSelect: 1,
  });
  expect(groups[0].options.map((o) => [o.name, o.price])).toEqual([
    ["Ketchup", 0],
    ["Mustard", 0.5],
  ]);
});
```

- [ ] **Step 3: Write failing test — MULTIPLE optional**

```typescript
it("maps MULTIPLE selection_type + min=0 to optional multi-select group", () => {
  const ml = buildModifierList("ml-1", "Toppings", "MULTIPLE", 0, 3, [
    buildModifier("mod-1", "Cheese",  100, 0),
    buildModifier("mod-2", "Bacon",   150, 1),
    buildModifier("mod-3", "Avocado", 200, 2),
  ]);
  const item = buildItem("item-1", "Burger", [buildVariation("v-1", "R", 500, 0)], {
    modifierListInfo: [{ modifierListId: "ml-1", enabled: true }],
  });
  const result = squareCatalogService.mapToMenuModels({
    categories: [], modifierLists: [ml], taxes: [], images: [], items: [item],
  });
  const group = result.items[0].modifiers!.groups[0];
  expect(group).toMatchObject({
    name: "Toppings",
    required: false,
    minSelect: 0,
    maxSelect: 3,
  });
});
```

- [ ] **Step 4: Write failing test — disabled modifierListInfo skipped**

```typescript
it("skips modifier list info when enabled is false", () => {
  const ml = buildModifierList("ml-1", "Sauce", "SINGLE", 1, 1, [
    buildModifier("mod-1", "Ketchup", 0, 0),
  ]);
  const item = buildItem("item-1", "Burger", [buildVariation("v-1", "R", 500, 0)], {
    modifierListInfo: [{ modifierListId: "ml-1", enabled: false }],
  });
  const result = squareCatalogService.mapToMenuModels({
    categories: [], modifierLists: [ml], taxes: [], images: [], items: [item],
  });
  expect(result.items[0].modifiers).toBeNull();
});
```

- [ ] **Step 5: Run failing tests**

```bash
npm run test:run -- square-catalog
```

- [ ] **Step 6: Update the modifierList mapping block**

Replace the existing `for (const mlInfo of modifierListInfo)` loop:

```typescript
const modifierListInfo = data.modifierListInfo ?? [];
for (const mlInfo of modifierListInfo) {
  if (mlInfo.enabled === false) continue;
  const ml = modifierListMap.get(mlInfo.modifierListId!);
  if (!ml || ml.type !== "MODIFIER_LIST") continue;
  const mlData = ml.modifierListData;
  if (!mlData) continue;

  const isSingle = mlData.selectionType === "SINGLE";
  const min = mlData.minSelectedModifiers ?? 0;
  const max =
    mlData.maxSelectedModifiers ?? (isSingle ? 1 : (mlData.modifiers?.length ?? 99));

  const modifiers = (mlData.modifiers ?? []).filter(
    (mod): mod is CatalogObject & { type: "MODIFIER" } => mod.type === "MODIFIER"
  );
  const sortedMods = [...modifiers].sort(
    (a, b) => (a.modifierData?.ordinal ?? 0) - (b.modifierData?.ordinal ?? 0)
  );

  groups.push({
    name: mlData.name ?? "Options",
    required: min > 0,
    minSelect: min,
    maxSelect: max,
    options: sortedMods.map((mod, idx) => ({
      name: mod.modifierData?.name ?? "Option",
      price: this.moneyToNumber(mod.modifierData?.priceMoney?.amount),
      externalId: mod.id,
      isDefault: false,
      ordinal: mod.modifierData?.ordinal ?? idx,
    })),
  });

  stats.modifierListsFlattened++;
}
```

(`stats` wiring comes in Task 13 — for now the stats line can be a `TODO` comment OR defer and remove the increment until Task 13 instantiates `stats`. Pick: **defer the `stats.modifierListsFlattened++` line** — add it back in Task 13.)

- [ ] **Step 7: Run tests**

```bash
npm run test:run -- square-catalog
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/services/square/square-catalog.service.ts src/services/square/__tests__/square-catalog.test.ts
git commit -m "feat(square): map ModifierList selection/min/max correctly"
```

---

## Task 12: `mapToMenuModels` — tax inclusion, category flatten, first image (TDD)

**Files:**
- Modify: `src/services/square/square-catalog.service.ts`
- Modify: `src/services/square/__tests__/square-catalog.test.ts`

- [ ] **Step 1: Write failing test — tax inclusionType**

```typescript
function buildTax(id: string, name: string, percentage: string, inclusion: "ADDITIVE" | "INCLUSIVE", phase: "TAX_SUBTOTAL_PHASE" | "TAX_TOTAL_PHASE" = "TAX_SUBTOTAL_PHASE"): CatalogObject {
  return {
    type: "TAX",
    id,
    taxData: { name, percentage, inclusionType: inclusion, calculationPhase: phase, enabled: true },
  } as CatalogObject;
}

it("maps ADDITIVE tax to additive inclusionType", () => {
  const result = squareCatalogService.mapToMenuModels({
    categories: [], modifierLists: [], images: [], items: [],
    taxes: [buildTax("tax-1", "Sales Tax", "8.25", "ADDITIVE")],
  });
  expect(result.taxes[0]).toMatchObject({ inclusionType: "additive", percentage: 8.25 });
});

it("maps INCLUSIVE tax to inclusive inclusionType", () => {
  const result = squareCatalogService.mapToMenuModels({
    categories: [], modifierLists: [], images: [], items: [],
    taxes: [buildTax("tax-2", "VAT", "10.0", "INCLUSIVE")],
  });
  expect(result.taxes[0]).toMatchObject({ inclusionType: "inclusive", percentage: 10 });
});

it("emits warning for TAX_TOTAL_PHASE (downgraded to subtotal)", () => {
  // Can be verified via stats.warnings in Task 13; for now ensure mapping still runs
  const result = squareCatalogService.mapToMenuModels({
    categories: [], modifierLists: [], images: [], items: [],
    taxes: [buildTax("tax-3", "Fee Tax", "1.0", "ADDITIVE", "TAX_TOTAL_PHASE")],
  });
  expect(result.taxes).toHaveLength(1); // still mapped
});
```

- [ ] **Step 2: Write failing test — tax linkage on item**

```typescript
it("populates taxExternalIds on MappedMenuItem from item.taxIds", () => {
  const tax = buildTax("tax-1", "Sales Tax", "8.25", "ADDITIVE");
  const item = buildItem("item-1", "Burger", [buildVariation("v-1", "R", 500, 0)], {
    taxIds: ["tax-1"],
  });
  const result = squareCatalogService.mapToMenuModels({
    categories: [], modifierLists: [], images: [], taxes: [tax], items: [item],
  });
  expect(result.items[0].taxExternalIds).toEqual(["tax-1"]);
});
```

- [ ] **Step 3: Write failing test — category flatten**

```typescript
function buildCategory(id: string, name: string, parentCategoryId?: string): CatalogObject {
  return {
    type: "CATEGORY",
    id,
    categoryData: {
      name,
      ...(parentCategoryId ? { parentCategory: { id: parentCategoryId, ordinal: 0 } } : {}),
    },
  } as CatalogObject;
}

it("flattens category hierarchy — keeps leaf and parent as separate flat categories", () => {
  const result = squareCatalogService.mapToMenuModels({
    modifierLists: [], taxes: [], images: [], items: [],
    categories: [
      buildCategory("cat-parent", "Drinks"),
      buildCategory("cat-child", "Coffee", "cat-parent"),
    ],
  });
  // Phase 1: both mapped flat, parent link dropped
  expect(result.categories.map((c) => c.name).sort()).toEqual(["Coffee", "Drinks"]);
});
```

- [ ] **Step 4: Write failing test — first image resolution**

```typescript
function buildImage(id: string, url: string): CatalogObject {
  return {
    type: "IMAGE",
    id,
    imageData: { url, caption: "" },
  } as CatalogObject;
}

it("resolves imageUrl from first image_id", () => {
  const img = buildImage("img-1", "https://example.com/a.jpg");
  const item = buildItem("item-1", "Burger", [buildVariation("v-1", "R", 500, 0)], {
    imageIds: ["img-1", "img-2"],
  });
  const result = squareCatalogService.mapToMenuModels({
    categories: [], modifierLists: [], taxes: [], items: [item], images: [img],
  });
  expect(result.items[0].imageUrl).toBe("https://example.com/a.jpg");
});

it("returns null imageUrl when image_ids is empty", () => {
  const item = buildItem("item-1", "Burger", [buildVariation("v-1", "R", 500, 0)]);
  const result = squareCatalogService.mapToMenuModels({
    categories: [], modifierLists: [], taxes: [], images: [], items: [item],
  });
  expect(result.items[0].imageUrl).toBeNull();
});
```

- [ ] **Step 5: Run failing tests**

```bash
npm run test:run -- square-catalog
```

- [ ] **Step 6: Update tax mapping**

Replace the `taxes` block in `mapToMenuModels`:

```typescript
const taxes: MappedTax[] = catalog.taxes
  .filter((t): t is CatalogObject & { type: "TAX" } => t.type === "TAX" && t.taxData?.enabled !== false)
  .map((t) => ({
    externalId: t.id,
    name: t.taxData?.name ?? "Tax",
    percentage: parseFloat(t.taxData?.percentage ?? "0"),
    inclusionType: t.taxData?.inclusionType === "INCLUSIVE" ? "inclusive" : "additive",
  }));
```

- [ ] **Step 7: Update category flatten logic**

The current code already flattens (it doesn't preserve `parentCategory`). Confirm tests pass for the hierarchy flatten case — if not, the category map is already the identity function. No code change needed. Keep the test as a regression guard.

- [ ] **Step 8: Add first-image resolution**

Build an image URL map at the top of `mapToMenuModels`:

```typescript
const imageUrlMap = new Map<string, string>();
for (const img of catalog.images) {
  if (img.type === "IMAGE" && img.imageData?.url) {
    imageUrlMap.set(img.id, img.imageData.url);
  }
}
```

In the item mapping, resolve `imageUrl`:

```typescript
const imageIds = data.imageIds ?? [];
const imageUrl = imageIds.length > 0 ? imageUrlMap.get(imageIds[0]) ?? null : null;
```

And include it in the returned `MappedMenuItem`.

- [ ] **Step 9: Add taxExternalIds**

In the item mapping, pass through:

```typescript
taxExternalIds: data.taxIds ?? [],
```

- [ ] **Step 10: Run tests**

```bash
npm run test:run -- square-catalog
```

Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add src/services/square/square-catalog.service.ts src/services/square/__tests__/square-catalog.test.ts
git commit -m "feat(square): map tax inclusionType, flatten categories, resolve first image"
```

---

## Task 13: `mapToMenuModels` — skip rules + stats emission (TDD)

**Files:**
- Modify: `src/services/square/square-catalog.service.ts`
- Modify: `src/services/square/__tests__/square-catalog.test.ts`

- [ ] **Step 1: Extend `MappedCatalog` return type with stats**

```typescript
import { createEmptyCatalogSyncStats, type CatalogSyncStats } from "@/services/integration/integration.types";

export interface MappedCatalog {
  categories: MappedCategory[];
  items: MappedMenuItem[];
  taxes: MappedTax[];
  stats: CatalogSyncStats;
}
```

- [ ] **Step 2: Write failing test — product_type filter**

```typescript
it("skips items with non-REGULAR/FOOD_AND_BEV product_type and increments stats", () => {
  const gc = buildItem("item-gc", "Gift Card", [buildVariation("v-1", "$10", 1000, 0)], {
    productType: "GIFT_CARD",
  });
  const reg = buildItem("item-b", "Burger", [buildVariation("v-2", "R", 500, 0)]);
  const result = squareCatalogService.mapToMenuModels({
    categories: [], modifierLists: [], taxes: [], images: [], items: [gc, reg],
  });
  expect(result.items).toHaveLength(1);
  expect(result.items[0].externalId).toBe("item-b");
  expect(result.stats.itemsSkipped).toBe(1);
});
```

- [ ] **Step 3: Write failing test — empty variations skip**

```typescript
it("skips items with no variations", () => {
  const item = buildItem("item-1", "Ghost", []);
  const result = squareCatalogService.mapToMenuModels({
    categories: [], modifierLists: [], taxes: [], images: [], items: [item],
  });
  expect(result.items).toHaveLength(0);
  expect(result.stats.itemsSkipped).toBe(1);
});
```

- [ ] **Step 4: Write failing test — VARIABLE_PRICING variation skipped**

```typescript
it("skips VARIABLE_PRICING variations and drops item if no valid variation remains", () => {
  const variable = {
    type: "ITEM_VARIATION",
    id: "v-1",
    itemVariationData: {
      name: "By Weight",
      ordinal: 0,
      pricingType: "VARIABLE_PRICING",
    },
  } as CatalogObject;
  const item = buildItem("item-1", "Bulk Rice", [variable]);
  const result = squareCatalogService.mapToMenuModels({
    categories: [], modifierLists: [], taxes: [], images: [], items: [item],
  });
  expect(result.items).toHaveLength(0);
  expect(result.stats.itemsSkipped).toBe(1);
});

it("skips VARIABLE_PRICING variation but maps item if other fixed variation exists", () => {
  const variable = {
    type: "ITEM_VARIATION",
    id: "v-var",
    itemVariationData: { name: "Weighted", ordinal: 0, pricingType: "VARIABLE_PRICING" },
  } as CatalogObject;
  const fixed = buildVariation("v-fix", "Fixed", 500, 1);
  const item = buildItem("item-1", "Mixed", [variable, fixed]);
  const result = squareCatalogService.mapToMenuModels({
    categories: [], modifierLists: [], taxes: [], images: [], items: [item],
  });
  expect(result.items).toHaveLength(1);
  expect(result.items[0].variationMappings).toHaveLength(1); // only fixed
});
```

- [ ] **Step 5: Write failing test — location_override warning**

```typescript
it("counts variation with location_overrides as locationOverridesDropped", () => {
  const v: CatalogObject = {
    type: "ITEM_VARIATION",
    id: "v-1",
    itemVariationData: {
      name: "R",
      ordinal: 0,
      pricingType: "FIXED_PRICING",
      priceMoney: { amount: 500n, currency: "USD" },
      locationOverrides: [{ locationId: "loc-1", priceMoney: { amount: 600n, currency: "USD" } }],
    },
  } as CatalogObject;
  const item = buildItem("item-1", "Burger", [v]);
  const result = squareCatalogService.mapToMenuModels({
    categories: [], modifierLists: [], taxes: [], images: [], items: [item],
  });
  expect(result.stats.locationOverridesDropped).toBe(1);
  expect(result.items[0].price).toBe(5); // global price retained
});
```

- [ ] **Step 6: Write failing test — stats count for variations-as-options and tax types**

```typescript
it("counts variationsAsOptions and tax type counts", () => {
  const result = squareCatalogService.mapToMenuModels({
    categories: [], modifierLists: [], images: [],
    taxes: [
      buildTax("t1", "VAT",   "10",   "INCLUSIVE"),
      buildTax("t2", "Sales", "5",    "ADDITIVE"),
      buildTax("t3", "Env",   "0.5",  "ADDITIVE"),
    ],
    items: [buildItem("i1", "Coffee", [
      buildVariation("v1", "S", 300, 0),
      buildVariation("v2", "L", 500, 1),
    ])],
  });
  expect(result.stats.variationsAsOptions).toBe(1);
  expect(result.stats.taxesInclusive).toBe(1);
  expect(result.stats.taxesAdditive).toBe(2);
});
```

- [ ] **Step 7: Run failing tests**

```bash
npm run test:run -- square-catalog
```

- [ ] **Step 8: Implement stats + skip rules**

At the top of `mapToMenuModels`, instantiate stats:

```typescript
const stats = createEmptyCatalogSyncStats();
```

In the item loop, replace `.map` with a `.reduce`-or-loop that can skip:

```typescript
const items: MappedMenuItem[] = [];
for (const item of catalog.items) {
  if (item.type !== "ITEM") continue;
  const data = item.itemData;
  if (!data) continue;

  // Skip non-supported product types
  const productType = data.productType ?? "REGULAR";
  if (productType !== "REGULAR" && productType !== "FOOD_AND_BEV" && productType !== "FOOD_AND_BEV_ITEM") {
    stats.itemsSkipped++;
    stats.warnings.push(`Item ${item.id} skipped: product_type=${productType}`);
    continue;
  }

  const allVariations = (data.variations ?? []).filter(
    (v): v is CatalogObject & { type: "ITEM_VARIATION" } => v.type === "ITEM_VARIATION"
  );

  // Filter out VARIABLE_PRICING
  const variations = allVariations.filter((v) => {
    if (v.itemVariationData?.pricingType === "VARIABLE_PRICING") {
      stats.warnings.push(`Variation ${v.id} skipped: VARIABLE_PRICING`);
      return false;
    }
    return true;
  });

  if (variations.length === 0) {
    stats.itemsSkipped++;
    stats.warnings.push(`Item ${item.id} skipped: no valid variations`);
    continue;
  }

  // Count location_overrides dropped
  for (const v of variations) {
    const overrides = v.itemVariationData?.locationOverrides ?? [];
    if (overrides.length > 0) {
      stats.locationOverridesDropped += overrides.length;
      stats.warnings.push(`Variation ${v.id} has ${overrides.length} location overrides (dropped)`);
    }
  }

  // ...existing variation → group + modifier list mapping (from Tasks 10+11)

  if (variations.length > 1) {
    stats.variationsAsOptions++;
  }

  // Count modifierListsFlattened inside the ml loop (added back here)
  // stats.modifierListsFlattened++ at the end of each ml iteration that actually mapped

  // Count dropped images (imageIds beyond first)
  const imageIds = data.imageIds ?? [];
  if (imageIds.length > 1) {
    stats.imagesDropped += imageIds.length - 1;
  }

  items.push({
    externalId: item.id,
    name: data.name ?? "Unnamed",
    description: data.descriptionPlaintext ?? data.description ?? null,
    price: basePrice,
    imageUrl,
    categoryExternalIds,
    taxExternalIds: data.taxIds ?? [],
    modifiers: groups.length > 0 ? { groups } : null,
    variationMappings,
  });

  stats.itemsCreated++;  // Phase 1 can't distinguish created vs updated here — wire in caller
}
```

Count tax types after the tax mapping:

```typescript
for (const t of taxes) {
  if (t.inclusionType === "inclusive") stats.taxesInclusive++;
  else stats.taxesAdditive++;
}
```

Return the stats:

```typescript
return { categories, items, taxes, stats };
```

**Note on `itemsCreated` vs `itemsUpdated`**: `mapToMenuModels` doesn't know if an item is new or an update — that's a DB-side distinction. Rename the counter at this layer to a single `itemsMapped` count, OR leave `itemsCreated` as a "mapping count" and let the caller that does the upsert split it into created/updated. The cleanest move: **add `itemsMapped: number` field** to `CatalogSyncStats`, keep `itemsCreated` / `itemsUpdated` at 0 here, let the upsert caller fill them. Update the type and the test expectations accordingly.

- [ ] **Step 9: Update `CatalogSyncStats` with `itemsMapped`**

In `src/services/integration/integration.types.ts`:

```typescript
export interface CatalogSyncStats {
  itemsMapped: number;       // NEW — set by mapToMenuModels
  itemsCreated: number;      // set by upsert caller
  itemsUpdated: number;      // set by upsert caller
  itemsSkipped: number;
  // ... rest unchanged
}
```

Update `createEmptyCatalogSyncStats` to include `itemsMapped: 0`.

- [ ] **Step 10: Use `itemsMapped` in the loop**

Replace `stats.itemsCreated++` with `stats.itemsMapped++`.

- [ ] **Step 11: Run tests**

```bash
npm run test:run -- square-catalog
```

Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add src/services/square/square-catalog.service.ts src/services/square/__tests__/square-catalog.test.ts src/services/integration/integration.types.ts
git commit -m "feat(square): add skip rules (product_type, VARIABLE_PRICING, empty variations) and emit CatalogSyncStats"
```

---

## Task 14: Full-suite regression and type check

**Files:** none (verification only)

- [ ] **Step 1: Run type check**

```bash
npx tsc --noEmit
```

Fix any remaining errors from cascading changes (most likely: a PriceSummary caller, or an order service path, that was missed).

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Fix any violations.

- [ ] **Step 3: Run full test suite**

```bash
npm run test:run
```

Fix any regressions. Common suspects:
- Tests that construct `ItemTaxConfig` without `inclusionType` → add `"additive"`
- Tests that call `mapToMenuModels` with a fixture missing `images: []` → add empty array
- Tests that destructure `PricingResult` and miss the new fields → harmless unless the shape is asserted
- Tests that render `PriceSummary` without the two new props → add them

- [ ] **Step 4: Run Prisma migration against a fresh dev DB to verify idempotency**

```bash
npx prisma migrate reset --force --skip-seed
npx prisma migrate dev
```

Expected: no errors; new columns present.

- [ ] **Step 5: Commit any fix-up changes**

```bash
git add -A
git commit -m "chore: fix cascading test/type updates from tax inclusion refactor"
```

---

## Out of Scope (explicit)

These are **not** in this plan and must not be attempted:
- Creating a `MenuItemVariation` table
- Abstracting modifiers into independent tables
- Plovr → Square write-back (order push)
- Delta / cursor-based incremental sync beyond writing `externalVersion` to the mapping row
- Multi-store menu override tables
- Inventory / SKU / barcode fields
- `CatalogDiscount` / `CatalogPricingRule` / `CatalogProductSet` / `CatalogTimePeriod` / `CatalogQuickAmountsSettings` / `CatalogMeasurementUnit` handling beyond counting them as skipped
- `CatalogItemOption` name resolution (currently defaults to `"Options"`; deferred to Phase 2)
- Modifying historical `Order.taxAmount` / `Order.subtotal` rows

## Self-review notes

- **Spec coverage**: every section of `2026-04-11-square-menu-compatibility-design.md` is addressed by tasks 1–13, with Task 14 as verification. Decision A → Tasks 9+10+13. Decision B → inherited (no schema change, JSON only). Decision C → Tasks 1+2+3+4+5+6+7. ExternalIdMapping `externalVersion` → Task 1 (schema; actual population by the upsert caller is downstream and out of scope for this plan — the field exists). `CatalogSyncStats` → Tasks 8+13.
- **Skipped in this plan**: the DB-upsert caller that actually writes `MappedCatalog` to Prisma (translating `MappedMenuItem` → `MenuItem.create` etc.) is **outside this plan's scope** because the wiring is handled by the pre-existing Square integration Phase 1 code path. If that caller does not yet exist in the codebase, a follow-up plan should add it; this plan delivers the mapping and pricing foundations it depends on.
- **externalVersion population**: The schema field exists after Task 1. The upsert caller (out of scope here) is responsible for writing `CatalogObject.version` into `ExternalIdMapping.externalVersion`. If the upsert caller is added as part of this plan's execution, extend Task 13 to pass `version` through `MappedMenuItem` / `MappedTax` / `MappedCategory`.
