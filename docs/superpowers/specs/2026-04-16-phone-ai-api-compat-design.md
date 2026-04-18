# Phone-AI External API Compatibility Design

**Issue**: #273 — phone-ai 接入 external v1 API 的兼容性适配需求
**Date**: 2026-04-16

## Summary

phone-ai 从旧 POS 系统切换到 plovr-grow 的 `/api/external/v1/*` 接口，需要 plovr-grow 侧补齐缺失的能力。主要涉及 4 个模块的改动。

---

## Module 1: Merchant Model — `phoneAiSettings` Field

### Schema Change

在 Merchant 模型新增 `phoneAiSettings` JSON 字段，存储所有 AI 电话相关配置。

```prisma
model Merchant {
  // ...existing fields...
  phoneAiSettings  Json?  @map("phone_ai_settings")
}
```

### TypeScript Type

```typescript
interface PhoneAiSettings {
  greetings?: string;                    // 来电开场白纯文本
  faq?: {
    savedFaqs?: Array<{ question: string; answer: string }>;
    customFaqs?: Array<{ question: string; answer: string }>;
  };
  agentWorkSwitch?: "0" | "1" | "2";    // "0"=ON, "1"=OFF, "2"=TWO_STAGE
  forwardPhone?: string;                 // 转人工号码
}
```

### Files to Change

- `prisma/schema.prisma` — add field
- `src/types/merchant.ts` — add `PhoneAiSettings` type, add to `MerchantInfo`
- Migration via `npm run db:migrate`

---

## Module 2: Knowledge API — Implement Missing Targets

Route: `POST /api/external/v1/knowledge/query`
File: `src/app/api/external/v1/knowledge/query/route.ts`

### Target Resolution

| Target | Data Source | Response Format |
|--------|------------|-----------------|
| `GREETINGS` | `merchant.phoneAiSettings.greetings` | `{ data: "<plain text>" }` or `null` if not set |
| `FAQ` | `merchant.phoneAiSettings.faq` | `{ data: JSON.stringify({ savedFaqs, customFaqs }) }` or `null` |
| `AGENT_WORK_SWITCH` | `merchant.phoneAiSettings.agentWorkSwitch` | `{ data: "0" }` (plain string) or `null` |
| `SERVICE_PROVIDED` | Derived from `merchant.settings` (MerchantSettings) | `{ data: JSON.stringify(serviceProvidedObj) }` |

### SERVICE_PROVIDED Mapping Logic

```typescript
{
  pickup: {
    openSwitch: settings.acceptsPickup ? 1 : 0,
    quoteTime: { min: settings.estimatedPrepTime ?? 15 }
  },
  delivery: {
    openSwitch: settings.acceptsDelivery ? 1 : 0
  },
  reservation: {
    openSwitch: 0  // plovr-grow does not support reservations yet
  }
}
```

### Implementation

The `resolveTarget` function needs to:
1. Access `merchant.phoneAiSettings` (parsed as `PhoneAiSettings`)
2. Access `merchant.settings` (parsed as `MerchantSettings`)
3. Return the appropriate data structure for each target

The merchant data is already fetched via `merchantService.getMerchantById()` — need to ensure it includes `phoneAiSettings` in the select/return.

### Files to Change

- `src/app/api/external/v1/knowledge/query/route.ts` — implement 4 target cases in `resolveTarget`
- `src/services/merchant/merchant.service.ts` — ensure `getMerchantById` returns `phoneAiSettings`
- `src/services/merchant/merchant.mapper.ts` — map `phoneAiSettings` from DB

---

## Module 3: Merchant Lookup — Return `forwardPhone`

Route: `POST /api/external/v1/merchants/lookup`
File: `src/app/api/external/v1/merchants/lookup/route.ts`

### Change

Add `forwardPhone` to the response object, sourced from the merchant's `phoneAiSettings.forwardPhone`.

```typescript
// In response
{
  // ...existing fields...
  forwardPhone: phoneAiSettings?.forwardPhone ?? null,
}
```

### Files to Change

- `src/app/api/external/v1/merchants/lookup/route.ts` — add `forwardPhone` to response
- `src/repositories/merchant.repository.ts` — ensure `getByAiPhone` select includes `phoneAiSettings`

---

## Module 4: Cart — Full Response with Price Summary

phone-ai 的旧 `editCart` 每次操作后都返回完整购物车状态（含 `receivable`、`itemSubTotal`、`taxTotal`），用于：
- 展示购物车摘要给客户
- 下单时传 `totalAmount`
- 金额校验（大额订单强制在线支付）

### Change

所有 cart 变更端点都返回完整的 `CartWithItems` + `summary`（而非当前的单个 item 或 null）。

#### 受影响的端点

| 端点 | 当前返回 | 改为返回 |
|------|----------|----------|
| `GET /carts/{cartId}` | `CartWithItems`（无汇总） | `CartWithItems` + `summary` |
| `POST /carts/{cartId}/items` | 单个 `CartItemData` | 完整 `CartWithItems` + `summary` |
| `PATCH /carts/{cartId}/items/{itemId}` | 单个 `CartItemData` | 完整 `CartWithItems` + `summary` |
| `DELETE /carts/{cartId}/items/{itemId}` | `null` | 完整 `CartWithItems` + `summary` |

#### CartSummary Type

```typescript
interface CartSummary {
  subtotal: number;    // sum of all items' totalPrice
  taxAmount: number;   // calculated via tax service
  total: number;       // subtotal + taxAmount
}

interface CartWithItems {
  // ...existing fields...
  summary: CartSummary;
}
```

### Implementation

- `cartService` 的 `addItem`、`updateItem`、`removeItem` 方法改为返回完整的 `CartWithItems`（含 `summary`），而非单个 item
- 抽取一个 `computeCartSummary` 方法供 `getCart` 和所有变更操作共用
- `subtotal` = sum of `item.totalPrice`
- `taxAmount` = 调用 tax service 计算（复用 checkout/order 中已有的税费计算逻辑）
- `total` = `subtotal` + `taxAmount`
- 各 route handler 中更新返回值

### Files to Change

- `src/services/cart/cart.types.ts` — add `CartSummary`, add `summary` to `CartWithItems`
- `src/services/cart/cart.service.ts` — add `computeCartSummary`, modify `addItem`/`updateItem`/`removeItem` to return full cart
- `src/app/api/external/v1/carts/[cartId]/items/route.ts` — update response
- `src/app/api/external/v1/carts/[cartId]/items/[itemId]/route.ts` — update response
- `src/app/api/external/v1/carts/[cartId]/route.ts` — update response
- Tax service integration — reuse existing tax calculation from order service

---

## No Code Changes Required (Confirmations)

- **Menu item IDs**: `menuItems[].id` in menu response = `menuItemId` in cart item operations
- **Modifier IDs**: `modifierGroups[].id` = `selectedModifiers[].modifierGroupId`, `options[].id` = `selectedModifiers[].modifierOptionId`
- **Order ID**: checkout returns `orderId` = ID used in `GET /orders/{orderId}` and `POST /orders/{orderId}/cancel`
- **Tenant flow**: phone-ai saves `tenantId` + `merchantId` from lookup, carries both in all subsequent calls
- **Checkout**: phone-ai adapts to plovr-grow's checkout input format (flat customer fields, `orderMode`)
- **Order detail/cancel**: phone-ai adapts to use `orderId` instead of `checkGroupUuid`

---

## Priority

1. **P0**: Module 1 (schema) + Module 2 (knowledge targets) — core flow dependencies
2. **P1**: Module 3 (forwardPhone) + Module 4 (cart full response + summary) — important for full flow
