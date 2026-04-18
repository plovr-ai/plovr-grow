# Phone-AI API Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement plovr-grow side changes so phone-ai can switch from the old POS system to plovr-grow's external v1 API.

**Architecture:** Add `phoneAiSettings` JSON field to the Merchant model for AI-specific config (greetings, FAQ, agent switch, forwardPhone). Implement 4 missing knowledge targets. Extend cart endpoints to return full cart with price summary (subtotal, tax, total) using the existing `calculateOrderPricing` module.

**Tech Stack:** Next.js App Router, TypeScript, Prisma ORM (MySQL), Vitest, Zod

**Spec:** `docs/superpowers/specs/2026-04-16-phone-ai-api-compat-design.md`

---

### Task 1: Add `phoneAiSettings` field to Merchant model

**Files:**
- Modify: `prisma/schema.prisma:218-259` (Merchant model)
- Modify: `src/types/merchant.ts`
- Modify: `src/services/merchant/merchant.types.ts`

- [ ] **Step 1: Add `PhoneAiSettings` type to `src/types/merchant.ts`**

Add after the `MerchantSettings` interface (around line 29):

```typescript
export interface PhoneAiSettings {
  greetings?: string;
  faq?: {
    savedFaqs?: Array<{ question: string; answer: string }>;
    customFaqs?: Array<{ question: string; answer: string }>;
  };
  agentWorkSwitch?: "0" | "1" | "2";
  forwardPhone?: string;
}
```

Add `phoneAiSettings` to the `MerchantInfo` interface:

```typescript
export interface MerchantInfo {
  // ...existing fields...
  settings: MerchantSettings | null;
  phoneAiSettings: PhoneAiSettings | null;  // ADD THIS
  createdAt: Date;
  updatedAt: Date;
}
```

- [ ] **Step 2: Add `phoneAiSettings` to service types**

In `src/services/merchant/merchant.types.ts`, add `phoneAiSettings` to `MerchantWithTenant` (around line 35) and `MerchantBasic` (around line 90):

```typescript
// In MerchantWithTenant:
  settings?: MerchantSettings;
  phoneAiSettings?: PhoneAiSettings;  // ADD THIS
  tenant: { ... };

// In MerchantBasic:
  settings?: MerchantSettings;
  phoneAiSettings?: PhoneAiSettings;  // ADD THIS
  createdAt: Date;
```

Import `PhoneAiSettings` at the top:

```typescript
import type {
  MerchantSettings,
  MerchantStatus,
  BusinessHoursMap,
  PhoneAiSettings,
} from "@/types/merchant";
```

- [ ] **Step 3: Update merchant mapper to include `phoneAiSettings`**

In `src/services/merchant/merchant.mapper.ts`, add mapping in `toMerchantWithTenant` (around line 52):

```typescript
    settings: (data.settings as unknown) as MerchantSettings | undefined,
    phoneAiSettings: (data.phoneAiSettings as unknown) as PhoneAiSettings | undefined,  // ADD THIS
    tenant: { ... },
```

Add the same in `toMerchantFromTenant` (around line 111):

```typescript
    settings: (merchant.settings as unknown) as MerchantSettings | undefined,
    phoneAiSettings: (merchant.phoneAiSettings as unknown) as PhoneAiSettings | undefined,  // ADD THIS
    tenant: { ... },
```

Import `PhoneAiSettings`:

```typescript
import type { MerchantSettings, MerchantStatus, BusinessHoursMap, PhoneAiSettings } from "@/types/merchant";
```

- [ ] **Step 4: Add field to Prisma schema**

In `prisma/schema.prisma`, add to the Merchant model (after `settings` field, around line 239):

```prisma
  settings               Json?
  phoneAiSettings        Json?                   @map("phone_ai_settings")
```

- [ ] **Step 5: Generate migration**

Run: `npm run db:migrate -- --name add_merchant_phone_ai_settings`

Expected: Prisma creates migration SQL with `ALTER TABLE merchants ADD COLUMN phone_ai_settings JSON NULL`.

- [ ] **Step 6: Generate Prisma client**

Run: `npm run db:generate`

Expected: Prisma client regenerated with `phoneAiSettings` field on Merchant.

- [ ] **Step 7: Verify build**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ src/types/merchant.ts src/services/merchant/merchant.types.ts src/services/merchant/merchant.mapper.ts
git commit -m "feat: add phoneAiSettings field to Merchant model (#273)"
```

---

### Task 2: Implement knowledge targets — GREETINGS, FAQ, AGENT_WORK_SWITCH

**Files:**
- Modify: `src/app/api/external/v1/knowledge/query/route.ts`
- Modify: `src/app/api/external/v1/knowledge/query/__tests__/route.test.ts`

- [ ] **Step 1: Write failing tests for GREETINGS target**

In `src/app/api/external/v1/knowledge/query/__tests__/route.test.ts`, add `phoneAiSettings` to `mockMerchant`:

```typescript
const mockMerchant = {
  // ...existing fields...
  settings: {
    acceptsPickup: true,
    acceptsDelivery: false,
    estimatedPrepTime: 20,
    tipConfig: { enabled: true, presets: [15, 18, 20] },
    feeConfig: { serviceFee: 0 },
  },
  phoneAiSettings: {
    greetings: "Welcome to Happy Wok! How can I help you?",
    faq: {
      savedFaqs: [{ question: "Do you have parking?", answer: "Yes, free parking." }],
      customFaqs: [],
    },
    agentWorkSwitch: "0",
    forwardPhone: "+14155559999",
  },
};
```

Then add these test cases:

```typescript
  it("should resolve GREETINGS target from phoneAiSettings", async () => {
    mockGetMerchantById.mockResolvedValue(mockMerchant);
    const response = await POST(createRequest({ tenantId: "t1", merchantId: "m1", targets: ["GREETINGS"] }));
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.data.knowledgeMap.GREETINGS).toEqual({
      data: "Welcome to Happy Wok! How can I help you?",
    });
  });

  it("should return null for GREETINGS when phoneAiSettings is null", async () => {
    mockGetMerchantById.mockResolvedValue({ ...mockMerchant, phoneAiSettings: null });
    const response = await POST(createRequest({ tenantId: "t1", merchantId: "m1", targets: ["GREETINGS"] }));
    const json = await response.json();
    expect(json.data.knowledgeMap.GREETINGS).toBeNull();
  });
```

- [ ] **Step 2: Write failing tests for FAQ and AGENT_WORK_SWITCH**

```typescript
  it("should resolve FAQ target from phoneAiSettings", async () => {
    mockGetMerchantById.mockResolvedValue(mockMerchant);
    const response = await POST(createRequest({ tenantId: "t1", merchantId: "m1", targets: ["FAQ"] }));
    const json = await response.json();
    expect(response.status).toBe(200);
    const faqData = JSON.parse(json.data.knowledgeMap.FAQ.data);
    expect(faqData.savedFaqs).toEqual([{ question: "Do you have parking?", answer: "Yes, free parking." }]);
    expect(faqData.customFaqs).toEqual([]);
  });

  it("should resolve AGENT_WORK_SWITCH target from phoneAiSettings", async () => {
    mockGetMerchantById.mockResolvedValue(mockMerchant);
    const response = await POST(createRequest({ tenantId: "t1", merchantId: "m1", targets: ["AGENT_WORK_SWITCH"] }));
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.data.knowledgeMap.AGENT_WORK_SWITCH).toEqual({ data: "0" });
  });
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/app/api/external/v1/knowledge/query/__tests__/route.test.ts`

Expected: FAIL — GREETINGS, FAQ, AGENT_WORK_SWITCH return `null`.

- [ ] **Step 4: Implement the 3 targets in `resolveTarget`**

In `src/app/api/external/v1/knowledge/query/route.ts`, import `PhoneAiSettings`:

```typescript
import type { PhoneAiSettings } from "@/types/merchant";
```

Update the `resolveTarget` function to accept parsed `phoneAiSettings`:

```typescript
async function resolveTarget(
  target: KnowledgeTarget,
  merchant: MerchantWithTenant
): Promise<KnowledgeEntry> {
  const phoneAiSettings = (merchant.phoneAiSettings ?? null) as PhoneAiSettings | null;

  switch (target) {
    // ...existing RESTAURANT_INFO, OPENING_HOURS, ORDER_CONFIG, MENU cases...

    case "GREETINGS":
      return phoneAiSettings?.greetings
        ? { data: phoneAiSettings.greetings }
        : null;

    case "FAQ":
      return phoneAiSettings?.faq
        ? { data: JSON.stringify(phoneAiSettings.faq) }
        : null;

    case "AGENT_WORK_SWITCH":
      return phoneAiSettings?.agentWorkSwitch
        ? { data: phoneAiSettings.agentWorkSwitch }
        : null;

    case "SERVICE_PROVIDED":
      return null; // Implemented in Task 3
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/app/api/external/v1/knowledge/query/__tests__/route.test.ts`

Expected: All new tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/external/v1/knowledge/query/route.ts src/app/api/external/v1/knowledge/query/__tests__/route.test.ts
git commit -m "feat: implement GREETINGS, FAQ, AGENT_WORK_SWITCH knowledge targets (#273)"
```

---

### Task 3: Implement knowledge target — SERVICE_PROVIDED

**Files:**
- Modify: `src/app/api/external/v1/knowledge/query/route.ts`
- Modify: `src/app/api/external/v1/knowledge/query/__tests__/route.test.ts`

- [ ] **Step 1: Write failing test for SERVICE_PROVIDED**

In the test file, add:

```typescript
  it("should resolve SERVICE_PROVIDED from merchant settings", async () => {
    mockGetMerchantById.mockResolvedValue(mockMerchant);
    const response = await POST(createRequest({ tenantId: "t1", merchantId: "m1", targets: ["SERVICE_PROVIDED"] }));
    const json = await response.json();
    expect(response.status).toBe(200);
    const serviceData = JSON.parse(json.data.knowledgeMap.SERVICE_PROVIDED.data);
    expect(serviceData.pickup.openSwitch).toBe(1);
    expect(serviceData.pickup.quoteTime.min).toBe(20);
    expect(serviceData.delivery.openSwitch).toBe(0);
    expect(serviceData.reservation.openSwitch).toBe(0);
  });

  it("should return default SERVICE_PROVIDED when settings is null", async () => {
    mockGetMerchantById.mockResolvedValue({ ...mockMerchant, settings: null });
    const response = await POST(createRequest({ tenantId: "t1", merchantId: "m1", targets: ["SERVICE_PROVIDED"] }));
    const json = await response.json();
    const serviceData = JSON.parse(json.data.knowledgeMap.SERVICE_PROVIDED.data);
    expect(serviceData.pickup.openSwitch).toBe(0);
    expect(serviceData.delivery.openSwitch).toBe(0);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/external/v1/knowledge/query/__tests__/route.test.ts`

Expected: FAIL — SERVICE_PROVIDED returns `null`.

- [ ] **Step 3: Implement SERVICE_PROVIDED in `resolveTarget`**

Replace the `case "SERVICE_PROVIDED": return null;` with:

```typescript
    case "SERVICE_PROVIDED": {
      const settings = (merchant.settings ?? {}) as MerchantSettings;
      return {
        data: JSON.stringify({
          pickup: {
            openSwitch: settings.acceptsPickup ? 1 : 0,
            quoteTime: { min: settings.estimatedPrepTime ?? 15 },
          },
          delivery: {
            openSwitch: settings.acceptsDelivery ? 1 : 0,
          },
          reservation: {
            openSwitch: 0,
          },
        }),
      };
    }
```

Add import at top:

```typescript
import type { MerchantSettings } from "@/types/merchant";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/api/external/v1/knowledge/query/__tests__/route.test.ts`

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/external/v1/knowledge/query/route.ts src/app/api/external/v1/knowledge/query/__tests__/route.test.ts
git commit -m "feat: implement SERVICE_PROVIDED knowledge target (#273)"
```

---

### Task 4: Add `forwardPhone` to merchant lookup response

**Files:**
- Modify: `src/repositories/merchant.repository.ts`
- Modify: `src/app/api/external/v1/merchants/lookup/route.ts`
- Modify: `src/app/api/external/v1/merchants/lookup/__tests__/route.test.ts`

- [ ] **Step 1: Write failing test**

In `src/app/api/external/v1/merchants/lookup/__tests__/route.test.ts`, update the success test to expect `forwardPhone`:

```typescript
  it("should return merchant data with forwardPhone on success", async () => {
    mockGetByAiPhone.mockResolvedValue({
      id: "m1", tenantId: "t1", name: "Happy Wok", timezone: "America/Los_Angeles",
      currency: "USD", locale: "en-US", phone: "+14155551234",
      address: "123 Main St", city: "San Francisco", state: "CA", zipCode: "94102",
      phoneAiSettings: { forwardPhone: "+14155559999" },
    });
    const response = await POST(createRequest({ phone: "+14155551234" }));
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.data.forwardPhone).toBe("+14155559999");
  });

  it("should return null forwardPhone when phoneAiSettings is null", async () => {
    mockGetByAiPhone.mockResolvedValue({
      id: "m1", tenantId: "t1", name: "Happy Wok", timezone: "America/Los_Angeles",
      currency: "USD", locale: "en-US", phone: "+14155551234",
      address: "123 Main St", city: "San Francisco", state: "CA", zipCode: "94102",
      phoneAiSettings: null,
    });
    const response = await POST(createRequest({ phone: "+14155551234" }));
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.data.forwardPhone).toBeNull();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/external/v1/merchants/lookup/__tests__/route.test.ts`

Expected: FAIL — `forwardPhone` is `undefined`.

- [ ] **Step 3: Update `getByAiPhone` to select `phoneAiSettings`**

In `src/repositories/merchant.repository.ts`, update the `getByAiPhone` method (around line 105):

```typescript
  async getByAiPhone(phone: string) {
    const normalized = phone.startsWith("+") ? phone.slice(1) : phone;
    const withPlus = `+${normalized}`;
    const withoutPlus = normalized;

    return prisma.merchant.findFirst({
      where: {
        OR: [{ aiPhone: withoutPlus }, { aiPhone: withPlus }],
        deleted: false,
      },
      select: {
        id: true,
        tenantId: true,
        name: true,
        timezone: true,
        currency: true,
        locale: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        phoneAiSettings: true,
      },
    });
  }
```

- [ ] **Step 4: Update lookup route to return `forwardPhone`**

In `src/app/api/external/v1/merchants/lookup/route.ts`, update the response (around line 51):

```typescript
  import type { PhoneAiSettings } from "@/types/merchant";

  // ...inside the handler, after finding merchant...

  const phoneAiSettings = (merchant.phoneAiSettings ?? null) as PhoneAiSettings | null;

  return NextResponse.json({
    success: true,
    data: {
      tenantId: merchant.tenantId,
      merchantId: merchant.id,
      merchantName: merchant.name,
      timezone: merchant.timezone,
      currency: merchant.currency,
      locale: merchant.locale,
      phone: merchant.phone,
      address: merchant.address,
      city: merchant.city,
      state: merchant.state,
      zipCode: merchant.zipCode,
      forwardPhone: phoneAiSettings?.forwardPhone ?? null,
    },
  });
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/app/api/external/v1/merchants/lookup/__tests__/route.test.ts`

Expected: All tests PASS. Note: the existing "should return merchant data on success" test will need its assertion updated to include `forwardPhone: undefined` or be replaced by the new test.

- [ ] **Step 6: Verify build**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/repositories/merchant.repository.ts src/app/api/external/v1/merchants/lookup/route.ts src/app/api/external/v1/merchants/lookup/__tests__/route.test.ts
git commit -m "feat: add forwardPhone to merchant lookup response (#273)"
```

---

### Task 5: Add `CartSummary` type and `computeCartSummary` to cart service

**Files:**
- Modify: `src/services/cart/cart.types.ts`
- Modify: `src/services/cart/cart.service.ts`

- [ ] **Step 1: Add `CartSummary` type**

In `src/services/cart/cart.types.ts`, add:

```typescript
export interface CartSummary {
  subtotal: number;
  taxAmount: number;
  total: number;
}
```

Update `CartWithItems` to include `summary`:

```typescript
export interface CartWithItems {
  id: string;
  tenantId: string;
  merchantId: string;
  status: CartStatus;
  salesChannel: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: CartItemData[];
  summary: CartSummary;
}
```

- [ ] **Step 2: Import tax dependencies in cart service**

In `src/services/cart/cart.service.ts`, add imports:

```typescript
import { taxConfigRepository } from "@/repositories/tax-config.repository";
import { calculateOrderPricing, type PricingItem } from "@/lib/pricing";
import type { RoundingMethod } from "@/services/menu/tax-config.types";
import type { CartSummary } from "./cart.types";
```

- [ ] **Step 3: Add `computeCartSummary` method to `CartService`**

Add this private method to the `CartService` class:

```typescript
  private async computeCartSummary(
    merchantId: string,
    items: CartItemData[]
  ): Promise<CartSummary> {
    if (items.length === 0) {
      return { subtotal: 0, taxAmount: 0, total: 0 };
    }

    const menuItemIds = items.map((item) => item.menuItemId);
    const itemTaxMap = await taxConfigRepository.getMenuItemsTaxConfigIds(menuItemIds);
    const allTaxConfigIds = [...new Set([...itemTaxMap.values()].flat())];

    const [taxConfigs, merchantTaxRateMap] = await Promise.all([
      taxConfigRepository.getTaxConfigsByIds(items[0].menuItemId ? merchantId : "", allTaxConfigIds),
      taxConfigRepository.getMerchantTaxRateMap(merchantId),
    ]);
    const taxConfigMap = new Map(taxConfigs.map((c) => [c.id, c]));

    const pricingItems: PricingItem[] = items.map((item) => {
      const taxConfigIds = itemTaxMap.get(item.menuItemId) || [];
      const taxes = taxConfigIds
        .map((taxId) => {
          const config = taxConfigMap.get(taxId);
          if (!config) return null;
          return {
            rate: merchantTaxRateMap.get(taxId) || 0,
            roundingMethod: config.roundingMethod as RoundingMethod,
            inclusionType: config.inclusionType,
          };
        })
        .filter((t): t is NonNullable<typeof t> => t !== null);

      return {
        itemId: item.menuItemId,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        taxes,
      };
    });

    const pricing = calculateOrderPricing(pricingItems);

    return {
      subtotal: pricing.subtotal,
      taxAmount: pricing.taxAmount,
      total: pricing.totalAmount,
    };
  }
```

- [ ] **Step 4: Update `getCart` to include summary**

Replace the `getCart` method's return to compute and include summary:

```typescript
  async getCart(tenantId: string, cartId: string): Promise<CartWithItems> {
    const cart = await cartRepository.findByIdWithItems(tenantId, cartId);
    if (!cart) {
      throw new AppError(ErrorCodes.CART_NOT_FOUND, undefined, 404);
    }

    const items: CartItemData[] = cart.cartItems.map((item): CartItemData => ({
      id: item.id,
      menuItemId: item.menuItemId,
      name: item.name,
      unitPrice: Number(item.unitPrice),
      quantity: item.quantity,
      totalPrice: Number(item.totalPrice),
      specialInstructions: item.specialInstructions,
      imageUrl: item.imageUrl,
      sortOrder: item.sortOrder,
      modifiers: item.modifiers.map((m): CartItemModifierData => ({
        id: m.id,
        modifierGroupId: m.modifierGroupId,
        modifierOptionId: m.modifierOptionId,
        groupName: m.groupName,
        name: m.name,
        price: Number(m.price),
        quantity: m.quantity,
      })),
    }));

    const summary = await this.computeCartSummary(cart.merchantId, items);

    return {
      id: cart.id,
      tenantId: cart.tenantId,
      merchantId: cart.merchantId,
      status: cart.status as CartWithItems["status"],
      salesChannel: cart.salesChannel,
      notes: cart.notes,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
      items,
      summary,
    };
  }
```

- [ ] **Step 5: Verify build**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/services/cart/cart.types.ts src/services/cart/cart.service.ts
git commit -m "feat: add cart price summary with tax calculation (#273)"
```

---

### Task 6: Cart mutation endpoints return full cart

**Files:**
- Modify: `src/services/cart/cart.service.ts`
- Modify: `src/app/api/external/v1/carts/[cartId]/items/route.ts`
- Modify: `src/app/api/external/v1/carts/[cartId]/items/[itemId]/route.ts`

- [ ] **Step 1: Modify `addItem` to return `CartWithItems`**

In `src/services/cart/cart.service.ts`, change `addItem` to return the full cart at the end instead of just the item:

```typescript
  async addItem(tenantId: string, cartId: string, input: AddCartItemInput): Promise<CartWithItems> {
    // ...existing validation and item creation logic stays the same...

    // Instead of: return this.mapCartItem(item);
    // Return the full cart:
    return this.getCart(tenantId, cartId);
  }
```

- [ ] **Step 2: Modify `updateItem` to return `CartWithItems`**

Change return type and both return paths:

```typescript
  async updateItem(
    tenantId: string,
    cartId: string,
    itemId: string,
    input: UpdateCartItemInput
  ): Promise<CartWithItems> {
    // ...existing validation and update logic stays the same...
    // But both branches (modifier changed / only quantity changed) end with:

    // Replace: return this.mapCartItem(updated);
    // With:
    return this.getCart(tenantId, cartId);
  }
```

- [ ] **Step 3: Modify `removeItem` to return `CartWithItems`**

```typescript
  async removeItem(tenantId: string, cartId: string, itemId: string): Promise<CartWithItems> {
    // ...existing validation and soft delete stays the same...

    await cartRepository.softDeleteItem(itemId);

    // Instead of: return; (void)
    return this.getCart(tenantId, cartId);
  }
```

- [ ] **Step 4: Update add-item route handler**

In `src/app/api/external/v1/carts/[cartId]/items/route.ts`, the response already passes `item` — just verify the data type change flows through:

```typescript
    // Line ~56-63: addItem now returns CartWithItems
    const cart = await cartService.addItem(tenantId, cartId, {
      menuItemId,
      quantity,
      selectedModifiers,
      specialInstructions,
    });

    return NextResponse.json({ success: true, data: cart }, { status: 201 });
```

Variable rename from `item` to `cart` for clarity.

- [ ] **Step 5: Update update-item route handler**

In `src/app/api/external/v1/carts/[cartId]/items/[itemId]/route.ts`, PATCH handler:

```typescript
    const cart = await cartService.updateItem(tenantId, cartId, itemId, {
      quantity,
      selectedModifiers,
      specialInstructions,
    });

    return NextResponse.json({ success: true, data: cart });
```

- [ ] **Step 6: Update delete-item route handler**

In the same file, DELETE handler:

```typescript
    const cart = await cartService.removeItem(parsed.data.tenantId, cartId, itemId);
    return NextResponse.json({ success: true, data: cart });
```

- [ ] **Step 7: Verify build**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add src/services/cart/cart.service.ts src/app/api/external/v1/carts/[cartId]/items/route.ts src/app/api/external/v1/carts/[cartId]/items/[itemId]/route.ts
git commit -m "feat: cart mutation endpoints return full cart with summary (#273)"
```

---

### Task 7: Add unit tests for cart summary and mutation responses

**Files:**
- Modify or create: `src/services/cart/__tests__/cart.service.test.ts`

- [ ] **Step 1: Write test for `getCart` returning summary**

Check if `src/services/cart/__tests__/cart.service.test.ts` exists. If not, create it. Add tests:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindByIdWithItems = vi.fn();
const mockFindById = vi.fn();
const mockFindItemById = vi.fn();
const mockAddItem = vi.fn();
const mockUpdateItem = vi.fn();
const mockSoftDeleteItem = vi.fn();
const mockGetNextSortOrder = vi.fn();
const mockGetItemsByIdsByCompany = vi.fn();
const mockReplaceItemModifiers = vi.fn();
const mockGetMenuItemsTaxConfigIds = vi.fn();
const mockGetTaxConfigsByIds = vi.fn();
const mockGetMerchantTaxRateMap = vi.fn();

vi.mock("@/repositories/cart.repository", () => ({
  cartRepository: {
    findByIdWithItems: (...args: unknown[]) => mockFindByIdWithItems(...args),
    findById: (...args: unknown[]) => mockFindById(...args),
    findItemById: (...args: unknown[]) => mockFindItemById(...args),
    addItem: (...args: unknown[]) => mockAddItem(...args),
    updateItem: (...args: unknown[]) => mockUpdateItem(...args),
    softDeleteItem: (...args: unknown[]) => mockSoftDeleteItem(...args),
    getNextSortOrder: (...args: unknown[]) => mockGetNextSortOrder(...args),
    replaceItemModifiers: (...args: unknown[]) => mockReplaceItemModifiers(...args),
  },
}));

vi.mock("@/repositories/menu.repository", () => ({
  menuRepository: {
    getItemsByIdsByCompany: (...args: unknown[]) => mockGetItemsByIdsByCompany(...args),
  },
}));

vi.mock("@/repositories/tax-config.repository", () => ({
  taxConfigRepository: {
    getMenuItemsTaxConfigIds: (...args: unknown[]) => mockGetMenuItemsTaxConfigIds(...args),
    getTaxConfigsByIds: (...args: unknown[]) => mockGetTaxConfigsByIds(...args),
    getMerchantTaxRateMap: (...args: unknown[]) => mockGetMerchantTaxRateMap(...args),
  },
}));

vi.mock("@/services/order", () => ({
  orderService: { createMerchantOrderAtomic: vi.fn() },
}));

import { CartService } from "../cart.service";

const cartService = new CartService();

const mockCartWithItems = {
  id: "cart-1",
  tenantId: "t1",
  merchantId: "m1",
  status: "active",
  salesChannel: "phone_order",
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  cartItems: [
    {
      id: "ci-1",
      menuItemId: "mi-1",
      name: "Kung Pao Chicken",
      unitPrice: 14.99,
      quantity: 2,
      totalPrice: 29.98,
      specialInstructions: null,
      imageUrl: null,
      sortOrder: 1,
      modifiers: [],
    },
  ],
};

describe("CartService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default tax mocks — no tax configured
    mockGetMenuItemsTaxConfigIds.mockResolvedValue(new Map());
    mockGetTaxConfigsByIds.mockResolvedValue([]);
    mockGetMerchantTaxRateMap.mockResolvedValue(new Map());
  });

  describe("getCart", () => {
    it("should return cart with summary", async () => {
      mockFindByIdWithItems.mockResolvedValue(mockCartWithItems);
      const result = await cartService.getCart("t1", "cart-1");

      expect(result.summary).toBeDefined();
      expect(result.summary.subtotal).toBe(29.98);
      expect(result.summary.taxAmount).toBe(0);
      expect(result.summary.total).toBe(29.98);
    });

    it("should return zero summary for empty cart", async () => {
      mockFindByIdWithItems.mockResolvedValue({ ...mockCartWithItems, cartItems: [] });
      const result = await cartService.getCart("t1", "cart-1");

      expect(result.summary).toEqual({ subtotal: 0, taxAmount: 0, total: 0 });
    });
  });
});
```

- [ ] **Step 2: Write test for `addItem` returning full cart**

```typescript
  describe("addItem", () => {
    it("should return full cart with summary after adding item", async () => {
      mockFindById.mockResolvedValue({ id: "cart-1", tenantId: "t1", status: "active" });
      mockGetItemsByIdsByCompany.mockResolvedValue([{ id: "mi-1", name: "Kung Pao Chicken", price: 14.99, imageUrl: null }]);
      mockGetNextSortOrder.mockResolvedValue(1);
      mockAddItem.mockResolvedValue({
        id: "ci-1", menuItemId: "mi-1", name: "Kung Pao Chicken",
        unitPrice: 14.99, quantity: 2, totalPrice: 29.98,
        specialInstructions: null, imageUrl: null, sortOrder: 1, modifiers: [],
      });
      mockFindByIdWithItems.mockResolvedValue(mockCartWithItems);

      const result = await cartService.addItem("t1", "cart-1", {
        menuItemId: "mi-1", quantity: 2,
      });

      expect(result.id).toBe("cart-1");
      expect(result.items).toHaveLength(1);
      expect(result.summary).toBeDefined();
      expect(result.summary.subtotal).toBe(29.98);
    });
  });
```

- [ ] **Step 3: Write test for `removeItem` returning full cart**

```typescript
  describe("removeItem", () => {
    it("should return full cart with summary after removing item", async () => {
      mockFindById.mockResolvedValue({ id: "cart-1", tenantId: "t1", status: "active" });
      mockFindItemById.mockResolvedValue({ id: "ci-1" });
      mockSoftDeleteItem.mockResolvedValue(undefined);
      mockFindByIdWithItems.mockResolvedValue({ ...mockCartWithItems, cartItems: [] });

      const result = await cartService.removeItem("t1", "cart-1", "ci-1");

      expect(result.id).toBe("cart-1");
      expect(result.items).toHaveLength(0);
      expect(result.summary).toEqual({ subtotal: 0, taxAmount: 0, total: 0 });
    });
  });
```

- [ ] **Step 4: Run all tests**

Run: `npx vitest run src/services/cart/__tests__/cart.service.test.ts`

Expected: All PASS.

- [ ] **Step 5: Run full test suite to check for regressions**

Run: `npm run test:run`

Expected: All existing tests pass. Some cart-related tests in other files may need their assertions updated if they previously expected single-item returns from `addItem`/`updateItem`. Check and fix any failures.

- [ ] **Step 6: Commit**

```bash
git add src/services/cart/__tests__/cart.service.test.ts
git commit -m "test: add unit tests for cart summary and mutation responses (#273)"
```

---

### Task 8: Update existing tests and run full verification

**Files:**
- Potentially modify: any existing tests that assert on `addItem`/`updateItem`/`removeItem` return values

- [ ] **Step 1: Find and fix broken tests**

Run: `npm run test:run 2>&1 | head -100`

Look for failures related to cart operations expecting single-item or void returns. Fix each assertion to expect the new `CartWithItems` shape.

Common patterns to look for:
- Tests asserting `addItem` returns a single `CartItemData` → now returns `CartWithItems`
- Tests asserting `removeItem` returns `void` → now returns `CartWithItems`
- Tests asserting `updateItem` returns a single `CartItemData` → now returns `CartWithItems`

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: No errors.

- [ ] **Step 3: Run full test suite**

Run: `npm run test:run`

Expected: All tests pass.

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 5: Commit any test fixes**

```bash
git add -A
git commit -m "fix: update existing tests for new cart response shape (#273)"
```

---

### Task 9: Update integration test

**Files:**
- Modify: `src/app/api/external/v1/__tests__/phone-ai-flow.integration.test.ts`

- [ ] **Step 1: Update mockMerchant with `phoneAiSettings`**

In the integration test, update the `mockGetMerchantById` mock data and add test scenarios that cover the new knowledge targets:

```typescript
const mockMerchantForKnowledge = {
  id: "m1",
  tenantId: "t1",
  name: "Happy Wok",
  slug: "happy-wok",
  address: "123 Main St",
  city: "San Francisco",
  state: "CA",
  zipCode: "94102",
  phone: "+14155551234",
  email: "info@happywok.com",
  timezone: "America/Los_Angeles",
  currency: "USD",
  locale: "en-US",
  businessHours: { mon: { open: "09:00", close: "22:00" } },
  settings: {
    acceptsPickup: true,
    acceptsDelivery: false,
    estimatedPrepTime: 20,
  },
  phoneAiSettings: {
    greetings: "Welcome to Happy Wok!",
    faq: {
      savedFaqs: [{ question: "Parking?", answer: "Yes, free parking." }],
      customFaqs: [],
    },
    agentWorkSwitch: "0",
    forwardPhone: "+14155559999",
  },
};
```

- [ ] **Step 2: Add test for knowledge targets including new ones**

```typescript
  it("should query all knowledge targets including phone-ai specific ones", async () => {
    mockGetMerchantById.mockResolvedValue(mockMerchantForKnowledge);
    const response = await knowledgeQueryPOST(createJsonRequest(
      "http://localhost/api/external/v1/knowledge/query",
      {
        tenantId: "t1",
        merchantId: "m1",
        targets: ["GREETINGS", "FAQ", "AGENT_WORK_SWITCH", "SERVICE_PROVIDED"],
      }
    ));
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.data.knowledgeMap.GREETINGS.data).toBe("Welcome to Happy Wok!");
    expect(json.data.knowledgeMap.AGENT_WORK_SWITCH.data).toBe("0");

    const faq = JSON.parse(json.data.knowledgeMap.FAQ.data);
    expect(faq.savedFaqs).toHaveLength(1);

    const service = JSON.parse(json.data.knowledgeMap.SERVICE_PROVIDED.data);
    expect(service.pickup.openSwitch).toBe(1);
    expect(service.pickup.quoteTime.min).toBe(20);
  });
```

- [ ] **Step 3: Add test for merchant lookup with forwardPhone**

```typescript
  it("should return forwardPhone in merchant lookup", async () => {
    // Use real DB merchant that was inserted with phoneAiSettings in beforeAll
    // Or update the existing merchant lookup test to verify forwardPhone
    const response = await lookupPOST(createJsonRequest(
      "http://localhost/api/external/v1/merchants/lookup",
      { phone: testMerchant.aiPhone }
    ));
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.data).toHaveProperty("forwardPhone");
  });
```

- [ ] **Step 4: Run integration tests**

Run: `npx vitest run --config vitest.config.integration.ts src/app/api/external/v1/__tests__/phone-ai-flow.integration.test.ts`

Expected: All PASS (requires MySQL running).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/external/v1/__tests__/phone-ai-flow.integration.test.ts
git commit -m "test: update phone-ai integration tests for new knowledge targets (#273)"
```
