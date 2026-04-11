# 订单模型与 Square 兼容性审计 (#99)

> Issue: #99 — 检测订单模型和 Square 系统的兼容性
> 日期: 2026-04-11
> 作者: compatibility audit
> 相关 PR: #42 (Square OAuth/Catalog), #43 (Square Order Push), #44 (Square Webhook)

## 1. 目的与范围

本文档是一份**纯分析文档**，目的是系统化列出 plovr-grow 内部 `Order` 模型与 Square Orders API + 履约 Webhook 的兼容性差异，为后续双向同步的健壮性改进提供 gap 清单。

范围：

- **下单方向**（我方 → Square）：用户在 plovr 下单并完成支付后，将订单 push 到 Square POS。
- **回调方向**（Square → 我方）：接收 Square Webhook（`order.updated`、`payment.completed`、`payment.updated`），更新 plovr 内部的订单状态。

**不包含**：

- Catalog 同步（在 #3 / PR #42 已完成，不在本 issue 范围）
- Payment 内部对接（Stripe Connect，非 Square 原生 tender）
- Customer / Loyalty 模型映射
- GBP / 其他 listing 类 integration

> 注：Square Orders API 的字段集以 `src/services/square/square-order.service.ts` 中 `import type` 的类型和两份设计文档已罗列的字段为准。凡设计文档与代码都未覆盖的字段，统一标注 **❓ 待查 Square 官方文档**，不做凭空推断。

---

## 2. 现状摘要

### 2.1 我方订单模型（来自 prisma/schema.prisma）

主表 `Order`（`prisma/schema.prisma:198-251`）采用扁平化 + JSON items 设计，没有独立的 `OrderItem` / `OrderItemModifier` / `OrderFulfillment` 表。关键特征：

- 所有金额使用 `Decimal(10,2)` —— 以**美元为单位**，不是 cents。
- `items` 字段是 `Json`，结构由 TypeScript 类型 `OrderItemData`（`src/types/index.ts:108-119`）和 `SelectedModifier`（`src/types/index.ts:33-40`）约束，运行时不做 schema 校验。
- 订单履约不是独立表，而是 `Order.fulfillmentStatus` + 一组时间戳字段：`confirmedAt` / `preparingAt` / `readyAt` / `fulfilledAt` / `cancelledAt`（`prisma/schema.prisma:225-229`）。
- 支付走独立的 `Payment` 表（`prisma/schema.prisma:677-716`），但该表**只对接 Stripe**（字段 `stripePaymentIntentId`、`stripeCustomerId`、`stripeAccountId`），没有 Square tender / external payment id 字段。
- 没有 `Order.externalId` / `externalSource` 字段 —— 内部订单与 Square 订单的对应关系完全依赖 `ExternalIdMapping`（`prisma/schema.prisma:870-888`）。

订单状态 enum 位于 `src/types/index.ts:89-106`：

- `OrderMode = "pickup" | "delivery" | "dine_in"`
- `OrderStatus = "created" | "partial_paid" | "completed" | "canceled"` —— 支付维度
- `FulfillmentStatus = "pending" | "confirmed" | "preparing" | "ready" | "fulfilled"` —— 履约维度
- `SalesChannel = "online_order" | "catering" | "giftcard"`

### 2.2 已实现的 Square 集成

| 模块 | 文件 | 行数 | 做了什么 |
|---|---|---|---|
| Order push | `src/services/square/square-order.service.ts` | 478 | `createOrder` / `updateOrderStatus` / `cancelOrder`，通过 Square SDK 的 `client.orders.create/get/update` |
| 事件监听 | `src/services/square/square-order-listener.ts` | 218 | 监听 `order.paid` / `order.fulfillment.*` / `order.cancelled` 并触发 push |
| Webhook | `src/services/square/square-webhook.service.ts` | 268 | 签名校验 + 事件路由 + `order.updated` / `payment.*` handler |
| 类型 | `src/services/square/square.types.ts` | 134 | 定义 `SquareOrderPushInput`、`FULFILLMENT_STATUS_MAP`、`REVERSE_FULFILLMENT_STATUS_MAP` |
| API route | `src/app/api/integration/square/webhook/route.ts` | 25 | 纯转发，取 raw body + 签名 header |

已实现的关键转换：

- 金额：`BigInt(Math.round(price * 100))` 转成 Square `Money.amount`（`square-order.service.ts:317-331`）。
- 幂等键：`sha256("${tenantId}:${merchantId}:${orderId}")` 截取成 UUID-like string（`square-order.service.ts:372-388`）。
- Fulfillment 固定为 PICKUP，state 初始为 PROPOSED（`square-order.service.ts:349-366`）。
- 只在 `order.paid` 事件之后才 push，支付前不推送（`square-order-listener.ts:40-105`）。

---

## 3. 字段级映射（下单方向：我们 → Square）

兼容性标记：✅ 兼容 / ⚠️ 部分兼容（需转换/降级）/ ❌ 不兼容（字段缺失或语义冲突）/ ❓ 待确认。

### 3.1 Order 主表

| 我方字段 | 类型 | Square 对应字段 | 兼容性 | 说明 |
|---|---|---|---|---|
| `Order.id` (`schema.prisma:199`) | `string(cuid)` | `Order.reference_id` | ✅ | 当前代码已写入 `referenceId: input.orderId`（`square-order.service.ts:90`） |
| `Order.tenantId` | `string` | — | ⚠️ | Square 无租户概念；通过 `IntegrationConnection` + `locationId` 隔离 |
| `Order.merchantId` | `string?` | `Order.location_id` | ⚠️ | 不是直接映射，需经 `IntegrationConnection.externalLocationId` 查询，且 `merchantId` 在 schema 中是 nullable（giftcard 场景为 null），giftcard 订单不应 push 到 Square |
| `Order.orderNumber` | `string` | `Order.ticket_name` + `metadata.plovr_order_number` | ✅ | 已写入两处（`square-order.service.ts:93-97`） |
| `Order.customerFirstName` + `lastName` | `string` | `Fulfillment.pickup_details.recipient.display_name` | ⚠️ | 代码把两者拼接（`square-order.service.ts:350-351`），Square recipient 没有拆分姓名字段 |
| `Order.customerPhone` | `string` | `Fulfillment.pickup_details.recipient.phone_number` | ✅ | 直接写入（`square-order.service.ts:360`） |
| `Order.customerEmail` | `string?` | `Fulfillment.pickup_details.recipient.email_address` | ✅ | 直接写入（`square-order.service.ts:361`） |
| `Order.orderMode` | `"pickup"\|"delivery"\|"dine_in"` | `Fulfillment.type` | ✅ | 已通过 `SQUARE_FULFILLMENT_TYPE_BY_ORDER_MODE` 映射：`pickup` → `PICKUP`、`delivery` → `DELIVERY`（携带 `Order.deliveryAddress` 到 `deliveryDetails.recipient.address`）、`dine_in` → `PICKUP` + note 加 `"Dine-in"` 前缀。修复于 #102 |
| `Order.salesChannel` | `"online_order"\|"catering"\|"giftcard"` | `Order.source.name` | ❓ | 当前没传 `source`，Square 侧无感知；`giftcard` 根本不该 push（缺校验） |
| `Order.status` (支付) | enum | `Order.state` / `Payment.tender` | ⚠️ | 详见 §4.2 |
| `Order.fulfillmentStatus` | enum | `Order.fulfillments[].state` | ⚠️ | 详见 §4.3 |
| `Order.items` | `Json` (OrderItemData[]) | `Order.line_items` | ⚠️ | JSON 结构需逐字段转换，详见 §3.2 |
| `Order.subtotal` | `Decimal(10,2)` 美元 | `Order.net_amounts.total_money` 或自动计算 | ⚠️ | 当前代码**不上传** subtotal，完全依赖 Square 按 line item 自行计算。若两端舍入规则不一致将出现漂移 |
| `Order.taxAmount` | `Decimal(10,2)` 美元 | `Order.net_amounts.tax_money` / `Order.taxes[]` | ❌ | 当前代码**不上传**任何税项。Square 支持 `OrderLineItemTax`（percentage / additive / inclusive），plovr 有自己的 `MenuItemTax` 体系，两端完全未对齐 |
| `Order.tipAmount` | `Decimal(10,2)` | `Order.tenders[].tip_money` 或 `service_charges` | ❌ | 当前未上传，小费信息在 Square 侧丢失 |
| `Order.deliveryFee` | `Decimal(10,2)` | `Order.service_charges[]` | ❌ | 未上传 |
| `Order.discount` | `Decimal(10,2)` | `Order.discounts[]` | ❌ | 未上传 |
| `Order.giftCardPayment` | `Decimal(10,2)` | `Order.tenders[].type = "OTHER"` 或 Square Gift Card API | ❌ | 未上传；plovr 的 giftcard 跟 Square 的 gift card 是两套系统 |
| `Order.cashPayment` | `Decimal(10,2)` | `Order.tenders[].type = "CASH"` | ❌ | 未上传 |
| `Order.totalAmount` | `Decimal(10,2)` | `Order.total_money` | ⚠️ | 代码将其放进 `SquareOrderPushInput.totalAmount`（`square.types.ts:50`）但 **从未写入 Square 请求**，只是保留在 push input 上 |
| `Order.notes` | `string?` | `Fulfillment.pickup_details.note` | ✅ | 已写入（`square-order.service.ts:363`） |
| `Order.deliveryAddress` | `Json?` | `Fulfillment.shipment_details.recipient.address` | ❌ | delivery 订单没有真正的 shipment fulfillment 实现 |
| `Order.scheduledAt` | `DateTime?` | `Fulfillment.pickup_details.pickup_at` | ❌ | 代码硬编码 `scheduleType: "ASAP"`（`square-order.service.ts:357`），预订单时间丢失 |
| `Order.paidAt` | `DateTime?` | — | ⚠️ | Square 侧通过 tender 自动记录，我方需回写 |
| `Order.confirmedAt / preparingAt / readyAt / fulfilledAt / cancelledAt` | `DateTime?` | `Fulfillment.pickup_details.accepted_at / ready_at / picked_up_at / canceled_at` | ⚠️ | Square 有对应字段但当前代码既不 push 也不从 webhook 回写（仅回写 `FULFILLMENT_TIMESTAMP_FIELD`，见 `square-webhook.service.ts:14-19`） |
| `Order.cancelReason` | `string?` | `Fulfillment.pickup_details.cancel_reason` | ⚠️ | `cancelOrder` 里会传（`square-order.service.ts:271-275`），但限制在 pickup 且截断 100 字符 |
| `Order.loyaltyMemberId` | `string?` | Square Loyalty API | ❌ | 两套 loyalty 系统，不映射 |
| `Order.deleted` | `bool` (软删) | — | ⚠️ | Square 不支持硬删，软删订单仍然会保留在 Square |

### 3.2 OrderItem（JSON: `Order.items[]`）

我方 JSON 结构来自 `OrderItemData`（`src/types/index.ts:108-119`）。对应 Square `OrderLineItem`（从 `square-order.service.ts:3-8` 的 import 可确认类型可用）。

| 我方字段 | 类型 | Square 对应字段 | 兼容性 | 说明 |
|---|---|---|---|---|
| `menuItemId` | `string` | `OrderLineItem.catalog_object_id` | ⚠️ | 需经 `ExternalIdMapping(internalType="MenuItem", externalType="ITEM_VARIATION")` 反查（`square-order.service.ts:407-418`）。没有 catalog 映射时退化为自由文本 line item |
| `name` | `string` | `OrderLineItem.name` | ✅ | 直接写入 |
| `price` | `number`（美元） | `OrderLineItem.base_price_money` (amount: cents) | ⚠️ | 需 `Math.round(price * 100)` 转 cents（`square-order.service.ts:328-331`），硬编码 `currency: "USD"` |
| `quantity` | `number` | `OrderLineItem.quantity`（string） | ⚠️ | Square 要求 string，已转换 |
| `totalPrice` | `number` | — | ❌ | Square 自动计算，我方冗余字段，不上传 |
| `specialInstructions` | `string?` | `OrderLineItem.note` | ✅ | 已写入（`square-order.service.ts:332`） |
| `taxConfigId` / `taxes` | `string?` / `ItemTaxInfo[]?` | `OrderLineItem.applied_taxes[]` | ❌ | 未映射，line item 级别的税完全丢失 |
| `imageUrl` | `string?` | — | ❌ | Square line item 无图片字段 |
| `selectedModifiers[]` | `SelectedModifier[]` | `OrderLineItem.modifiers[]` | ⚠️ | 详见 §3.3 |

### 3.3 OrderItemModifier（JSON: `OrderItemData.selectedModifiers[]`）

对应 `OrderLineItemModifier`（`square-order.service.ts:4`）。我方结构来自 `SelectedModifier`（`src/types/index.ts:33-40`）。

| 我方字段 | 类型 | Square 对应字段 | 兼容性 | 说明 |
|---|---|---|---|---|
| `groupId` | `string` | — | ❌ | Square `OrderLineItemModifier` 没有 group 概念，modifier 是扁平的 |
| `groupName` | `string` | — | ❌ | 同上，group 信息丢失 |
| `modifierId` | `string` | `OrderLineItemModifier.catalog_object_id` | ⚠️ | 需经 `ExternalIdMapping(internalType="MenuItem", externalType="MODIFIER")` 反查（`square-order.service.ts:421-433`）。注意 `internalType` 仍写成 "MenuItem"，这是现有代码的历史遗留 |
| `modifierName` | `string` | `OrderLineItemModifier.name` | ✅ | 已写入（`square-order.service.ts:315`） |
| `price` | `number` 美元 | `OrderLineItemModifier.base_price_money` (cents) | ⚠️ | 已转换 cents |
| `quantity` | `number` | `OrderLineItemModifier.quantity` (string) | ✅ | 已转换 string |

### 3.4 OrderFulfillment（`Order.fulfillmentStatus` + 时间戳）

我方没有独立的 fulfillment 表，全部靠 `Order` 主表上的字段。对应 Square `Fulfillment`（`square-order.service.ts:5`）。

| 我方字段 | 类型 | Square 对应字段 | 兼容性 | 说明 |
|---|---|---|---|---|
| `Order.orderMode` | `OrderMode` | `Fulfillment.type` | ✅ | 已映射（详见 §3.1），delivery 写入 `deliveryDetails.recipient.address`，dine_in 回退 `PICKUP` + note 前缀 |
| `Order.fulfillmentStatus` | `FulfillmentStatus` | `Fulfillment.state` | ⚠️ | 见 §4.3 |
| `Order.scheduledAt` | `DateTime?` | `Fulfillment.pickup_details.pickup_at` | ❌ | 丢失，固定 ASAP |
| `Order.confirmedAt` | `DateTime?` | `Fulfillment.pickup_details.accepted_at` | ⚠️ | 当前仅单向（Square → 我方），push 时不 set |
| `Order.readyAt` | `DateTime?` | `Fulfillment.pickup_details.ready_at` | ⚠️ | 同上 |
| `Order.fulfilledAt` | `DateTime?` | `Fulfillment.pickup_details.picked_up_at` | ⚠️ | 同上 |
| `Order.preparingAt` | `DateTime?` | — | ❓ | Square PICKUP 没有独立的 preparing 时间戳字段 |
| — | — | `Fulfillment.uid` | ⚠️ | Square 要求在 update 时回传 uid，代码依赖 `get()` 再读取（`square-order.service.ts:188`）；我方未缓存 uid，每次多一次 API |
| — | — | `Fulfillment.pickup_details.prep_time_duration` | ❓ | Square 支持 ISO 8601 duration，我方无映射 |

### 3.5 Payment（独立表）

我方 `Payment`（`prisma/schema.prisma:677-716`）**完全面向 Stripe**，Square 侧代码仅通过 webhook 更新 `Order.status` / `Order.paidAt`，从不写 `Payment` 表。

| 我方字段 | 类型 | Square 对应字段 | 兼容性 | 说明 |
|---|---|---|---|---|
| `Payment.stripePaymentIntentId` | `string @unique` | — | ❌ | 强制要求 Stripe PaymentIntent ID，Square tender 无法复用此表 |
| `Payment.amount` | `Decimal(10,2)` | `Payment.amount_money` / `Tender.amount_money` | ⚠️ | 数值兼容，但 Square 用 cents |
| `Payment.currency` | `string("USD")` | `Money.currency` | ✅ | 默认 USD |
| `Payment.status` | `"pending"\|"processing"\|"succeeded"\|"failed"\|"canceled"` | `Payment.status = APPROVED / COMPLETED / CANCELED / FAILED` | ⚠️ | 语义相近但具体枚举值不一致 |
| `Payment.paymentMethod` | `string?` (card/apple_pay/google_pay) | `Payment.source_type = CARD / CASH / EXTERNAL ...` | ⚠️ | Square 粒度更细 |
| `Payment.cardBrand` / `cardLast4` | `string?` | `Payment.card_details.card.card_brand / last_4` | ✅ | 可映射 |
| `Payment.failureCode` / `failureMessage` | `string?` | `Payment.processing_fee` / error 字段 | ❓ | Square 错误模型未读代码 |
| `Payment.paidAt` | `DateTime?` | `Payment.created_at` | ✅ | 可映射 |
| — | — | `Payment.id` (Square) | ❌ | 我方无 `externalPaymentId` 字段 |
| — | — | `Payment.order_id` (Square) | ❌ | 只能通过 `ExternalIdMapping` 反查 |

---

## 4. 状态枚举映射

### 4.1 订单状态（我方 `OrderStatus` ↔ Square `Order.state`）

> 代码中**没有**这一层映射。push 时代码不设置 `Order.state`，Square 默认 OPEN。

| 我方 `OrderStatus` | Square `Order.state`（推测） | 映射状态 |
|---|---|---|
| `created` | `OPEN`（Square 默认） | ⚠️ 未显式映射 |
| `partial_paid` | ❓（Square 无此概念） | ❌ 无直接对应 |
| `completed` | `COMPLETED` | ⚠️ 未显式映射，目前依赖 webhook 从 payment 推出 |
| `canceled` | `CANCELED` | ⚠️ 未显式 push，只通过 `cancelOrder` fulfillment 级别取消 |

`OrderStatus` 的“支付状态”语义与 Square `Order.state` 的“订单生命周期状态”语义不是一一对应的 —— Square 侧 `OPEN`/`COMPLETED` 更接近订单是否最终结账，支付维度 Square 另有 `Tender` 和 `Payment` 模型。

### 4.2 支付状态

我方 `Payment.status` 和 `Order.status` 双轨并存：

- `Order.status` 走 `created → partial_paid → completed → canceled`
- `Payment.status` 走 Stripe 风格 `pending → processing → succeeded → failed → canceled`

Square webhook handler（`square-webhook.service.ts:213-265`）**仅更新 `Order.status` 和 `Order.paidAt`**，从不写 `Payment` 表。这意味着：

- Square 成功支付后，我方没有对应 `Payment` 记录，数据审计链断裂。
- 若同一笔订单先走 Stripe 再走 Square（少见但不是不可能），两套 `Payment.status` 会冲突。

### 4.3 履约状态（双向已经实现，但不对称）

`FULFILLMENT_STATUS_MAP`（`square.types.ts:80-86`）—— 我方 → Square：

| 我方 `FulfillmentStatus` | Square `FulfillmentState` | 备注 |
|---|---|---|
| `pending` | `PROPOSED` | ✅ |
| `confirmed` | `PROPOSED` | ⚠️ 两个内部状态映射到同一 Square state，反向无法还原 |
| `preparing` | `RESERVED` | ✅ |
| `ready` | `PREPARED` | ✅ |
| `fulfilled` | `COMPLETED` | ✅ |
| — | `CANCELED` | ⚠️ 未在此表，走 `cancelOrder` 独立路径 |
| — | `FAILED` | ❌ Square 有 `FAILED` state，我方无对应 |

`REVERSE_FULFILLMENT_STATUS_MAP`（`square.types.ts:124-129`）—— Square → 我方：

| Square `FulfillmentState` | 我方 `FulfillmentStatus` | 备注 |
|---|---|---|
| `PROPOSED` | `pending` | ⚠️ 不可逆 —— push 时 `confirmed` 也映射成 `PROPOSED`，回来只能变 `pending`，状态回退 |
| `RESERVED` | `preparing` | ✅ |
| `PREPARED` | `ready` | ✅ |
| `COMPLETED` | `fulfilled` | ✅ |
| `CANCELED` | —（未映射） | ❌ webhook 收到 CANCELED 会被当未知值跳过，`Order.cancelledAt` 不更新 |
| `FAILED` | —（未映射） | ❌ 同上 |

---

## 5. 回调方向（Square → 我们）

### 5.1 已处理的事件清单

来源 `square-webhook.service.ts:101-122` 和 design doc §「处理的事件类型」：

| Square 事件 | Handler | 当前行为 | 引用 |
|---|---|---|---|
| `catalog.version.updated` | `handleCatalogChange` | 触发全量 catalog re-sync | `square-webhook.service.ts:124-153` |
| `order.updated` | `handleOrderUpdate` | 反查 `ExternalIdMapping`，更新 `fulfillmentStatus` + 对应时间戳 | `square-webhook.service.ts:155-211` |
| `payment.completed` | `handlePaymentEvent` | 反查 mapping，更新 `Order.status = "completed"` + `paidAt` | `square-webhook.service.ts:213-251` |
| `payment.updated` | `handlePaymentEvent` | 同上，或 `status = "canceled"` + `cancelReason = "Payment failed on Square"` | `square-webhook.service.ts:252-264` |
| 其它 | default | 仅存 `WebhookEvent`，不处理 | `square-webhook.service.ts:117-121` |

### 5.2 未处理但 Square 会发送的事件（待查）

设计文档没列全 Square 的事件集，下列事件**是否存在以及是否需要订阅，待查 Square 官方文档**：

- `order.created`（Square 侧被动创建的订单）❓
- `order.fulfillment.updated`（是否独立于 `order.updated`）❓
- `refund.created` / `refund.updated` ❓
- `invoice.*` ❓
- `dispute.*` / `dispute.evidence.*` ❓

### 5.3 回写时的字段缺口

`handleOrderUpdate`（`square-webhook.service.ts:155-211`）当前仅回写：

- `Order.fulfillmentStatus`
- 对应时间戳字段（`confirmedAt` / `preparingAt` / `readyAt` / `fulfilledAt`，见 `FULFILLMENT_TIMESTAMP_FIELD` 表 `square-webhook.service.ts:14-19`）

**不回写**的字段：

- `Order.status`（支付维度）—— 没有基于 Square tender/payment 的变更触发
- `Order.cancelledAt` / `Order.cancelReason`（Square CANCELED state 未进 map）
- `Order.totalAmount` 等金额（Square 侧修改价格不会反向同步）
- `Payment` 表完全不写，Square 端 `payment.id` 丢失
- Webhook `data.object` 的 `version` 字段（用于并发控制）未用于乐观锁 —— 若 Square 并发推送两条 `order.updated`，可能出现 stale overwrite

`handlePaymentEvent`（`square-webhook.service.ts:213-265`）的缺口：

- 只看 payment `status`，不看 `amount` / `tip_money` / `processing_fee` —— 在部分支付或退款场景下无法正确还原金额
- `FAILED` 分支直接将 `Order.status = "canceled"` + `cancelledAt = now()` —— 但我方 `OrderStatus` 并没有 `"canceled"` 值（正确拼写是 `"canceled"`，我方 enum 也是 `"canceled"`，实际拼写 OK；但 `Order.cancelledAt` 字段名是两个 l）。拼写对，但语义上支付失败不等价于订单取消，强行覆盖会污染运营报表
- 找不到 mapping 时静默跳过，没有报警 —— 可能掩盖 push 方向的数据写入问题

---

## 6. 发现的缺口（Gap List）

### P0 — 阻塞双向同步

1. **金额字段不上传**
   - 问题：`Order.taxAmount` / `tipAmount` / `deliveryFee` / `discount` / `totalAmount` 全部不写入 Square `createOrder` 请求（`square-order.service.ts:86-99`）。
   - 影响：Square 端看到的订单金额是靠 line item 自行计算，与我方落库金额会出现差额；小费、折扣、运费在 Square 报表中完全丢失。
   - 建议：push 时使用 `service_charges` / `discounts` / `Fulfillment.pickup_details` 合并结构，或者切换成 `Order.pricing_options` 手动指定 total。

2. **税项不映射**
   - 问题：`OrderItemData.taxes` / `Order.taxAmount` 完全未 push；Square catalog sync 已经建立 `TaxConfig` 映射（design doc §「Catalog Mapping」），但下单链路没有消费它。
   - 影响：Square 报表税额=0，美国合规风险。
   - 建议：复用 `ExternalIdMapping(internalType="TaxConfig", externalType="TAX")`，生成 `OrderLineItem.applied_taxes[]`。

3. ~~**OrderMode 硬编码 PICKUP**~~ ✅ 已修复（#102）
   - 修复：新增 `SQUARE_FULFILLMENT_TYPE_BY_ORDER_MODE` 映射，`buildFulfillment` 按 `orderMode` 分支构造 `pickupDetails` / `deliveryDetails`；delivery 订单强制要求 `Order.deliveryAddress`（缺失抛 `SQUARE_MISSING_DELIVERY_ADDRESS`）；dine_in 回退 `PICKUP` 并在 note 前加 `"Dine-in"` 前缀。cancel 流程也会按 fulfillment 类型把 `cancelReason` 写到 `pickupDetails` 或 `deliveryDetails`。

4. **履约 CANCELED / FAILED 状态无反向映射**
   - 问题：`REVERSE_FULFILLMENT_STATUS_MAP` 缺 `CANCELED` / `FAILED`（`square.types.ts:124-129`）。
   - 影响：门店在 Square POS 取消订单，我方 `Order.cancelledAt` 永远不更新 —— 用户看不到订单已取消。
   - 建议：补齐 map + 在 `handleOrderUpdate` 写入 `cancelledAt` / `cancelReason`。

5. **`confirmed ↔ PROPOSED` 双向塌陷**
   - 问题：`FULFILLMENT_STATUS_MAP` 把 `pending` 和 `confirmed` 都映射到 `PROPOSED`（`square.types.ts:81-82`），反向只能还原成 `pending`，导致状态回退。
   - 影响：已 confirm 的订单在收到 Square webhook 后又被打回 `pending`，前端展示抖动。
   - 建议：`confirmed` 映射到 `RESERVED`，或在 Square 侧使用 `Fulfillment.pickup_details.accepted_at` 区分。

6. **`Payment` 表仅支持 Stripe**
   - 问题：`Payment.stripePaymentIntentId` 是 `@unique` 且 non-null（`prisma/schema.prisma:683`），Square 支付无法写入此表。
   - 影响：Square 侧支付信息仅写到 `Order.status` / `paidAt`，审计链断裂；退款、金额变更无法追踪。
   - 建议：重构为 provider 无关的 Payment 表（新增 `provider`、`externalPaymentId`、`externalCustomerId`），或新增 `SquarePayment` 子表。

### P1 — 功能降级

7. **`scheduledAt` 丢失**
   - 问题：`Fulfillment.pickup_details.scheduleType` 硬编码 `ASAP`，`pickup_at` 从不写（`square-order.service.ts:357`）。
   - 影响：预定单在 Square 显示为立即取，门店无法提前准备。
   - 建议：`scheduledAt ? "SCHEDULED" + pickup_at : "ASAP"`。

8. **Modifier group 信息丢失**
   - 问题：`SelectedModifier.groupId` / `groupName` 在 Square `OrderLineItemModifier` 里没有对应字段（§3.3）。
   - 影响：Square 侧报表无法按 modifier group 聚合（如 "Size" vs "Temperature"）。
   - 建议：退路是把 groupName 拼到 `OrderLineItemModifier.name` 前缀，如 `"Size: Large"`。

9. **幂等键不可逆**
   - 问题：`generateIdempotencyKey` 只依赖 `tenant+merchant+orderId`（`square-order.service.ts:372-388`），同一订单重推一次 Square 会认为重复，禁止修改。
   - 影响：首次 push 失败后代码修复 line items 再 push，Square 拒绝。
   - 建议：加入一个 retry counter 或 version hash。

10. **Webhook 并发 / 乱序**
    - 问题：`handleOrderUpdate` 直接 `prisma.order.update`，不校验 Square `version`。
    - 影响：两条 webhook 乱序到达会导致 stale 覆盖新状态。
    - 建议：存 `squareOrderVersion` 字段，update 时 `WHERE version < incoming`。

11. **Giftcard 订单未隔离**
    - 问题：`order.paid` 事件监听器不校验 `salesChannel`，giftcard 订单也会走 push 流程（`square-order-listener.ts:40-105`）。
    - 影响：giftcard 虚拟订单在 Square 表现为非法订单（`merchantId` 为 null 时会抛 `SQUARE_MISSING_LOCATION`）。
    - 建议：在 listener 开头跳过 `salesChannel === "giftcard"`。

12. **`payment.failed → status = "canceled"` 语义越权**
    - 问题：`square-webhook.service.ts:252-260` 用「支付失败」直接把订单状态写成 canceled。
    - 影响：取消原因被污染成 "Payment failed on Square"，运营侧统计失真。
    - 建议：区分「支付失败」和「订单取消」两个语义，引入独立的 `payment_failed` 支付子状态或只更新 Payment 侧。

13. **找不到 mapping 时静默**
    - 问题：`handleOrderUpdate` / `handlePaymentEvent` 在没 mapping 时直接 return 不报警（`square-webhook.service.ts:188-193`, `236-241`）。
    - 影响：push 侧出问题（mapping 没写入）时回调侧无感知，难排查。
    - 建议：添加计数指标或日志告警级别升为 warn。

### P2 — 可忽略 / 未来优化

14. **`Order.items` 是 JSON 而非独立表**
    - 问题：无法在 SQL 层按菜品聚合，也无法对 line item 级建立 `ExternalIdMapping(internalType="OrderLineItem")`。
    - 影响：当前 push 流程可以工作（通过 JSON 内的 menuItemId），但未来若要做行级对账会缺失主键。
    - 建议：长期可考虑规范化 `OrderItem` / `OrderItemModifier` 表，但要权衡现有查询性能。

15. **Fulfillment UID 未缓存**
    - 问题：每次 `updateOrderStatus` 都要先 `get` 一次 Square order 取 `fulfillment.uid`（`square-order.service.ts:178-189`）。
    - 影响：多一次 API call，Square rate limit 下可能成瓶颈。
    - 建议：在 `ExternalIdMapping` 加一个辅助表或 `extraData` 字段记录 uid + version。

16. **Source / 销售渠道未 push**
    - 问题：`salesChannel` 未写入 Square `Order.source.name`。
    - 影响：Square 报表无法区分 online_order vs catering。
    - 建议：在 `createOrder` 请求加 `source: { name: salesChannel }`。

17. **未订阅 refund / dispute 事件**
    - 问题：当前仅订阅 `order.updated` / `payment.*`，退款和争议场景没覆盖。
    - 影响：Square 侧退款不会回写到我方订单。
    - 建议：新增 `refund.created` / `refund.updated` handler（具体事件名待查）。

18. **Webhook `FAILED` 状态没有重试机制**
    - 问题：`WebhookEvent.status = "failed"` 之后没有定时重放（design doc §5 确认仅记录状态）。
    - 影响：暂态错误会丢事件。
    - 建议：加一个 cron 或手动重放接口。

---

## 7. 建议的后续 issue 拆分

以下为建议拆出的独立 issue，按优先级排序。每条一句话说明，实际实施时再细化：

1. `feat(square): push order tax/tip/discount/delivery fee to Square` — 补齐 §6 P0-1、P0-2 金额与税项字段映射。
2. `feat(square): map OrderMode to Square fulfillment type (pickup/delivery/dine_in)` — 修复 §6 P0-3 硬编码 PICKUP。
3. `fix(square): reverse map CANCELED / FAILED fulfillment state` — 修复 §6 P0-4，`handleOrderUpdate` 写入 `cancelledAt`。
4. `fix(square): avoid confirmed → PROPOSED collapse in fulfillment status map` — 修复 §6 P0-5。
5. `refactor(payment): make Payment table provider-agnostic (stripe + square)` — 修复 §6 P0-6，为未来任何 POS 支付留空间。
6. `feat(square): support scheduled pickup via pickup_at` — 修复 §6 P1-7。
7. `feat(square): include modifier group name in pushed modifier label` — §6 P1-8 的降级方案。
8. `fix(square): idempotency key should include retry version` — §6 P1-9。
9. `feat(square): guard against out-of-order webhooks using order version` — §6 P1-10 乐观锁。
10. `fix(square): skip order push for giftcard sales channel` — §6 P1-11。
11. `fix(square): decouple payment.failed from order.cancel semantics` — §6 P1-12。
12. `chore(square): alert when webhook cannot resolve ExternalIdMapping` — §6 P1-13 观测性。
13. `feat(square): handle refund.created / refund.updated webhooks` — §6 P2-17（需先查 Square 官方文档）。
14. `chore(square): retry failed WebhookEvent entries` — §6 P2-18。
15. `docs(square): audit remaining Square webhook event types` — 补齐 §5.2 的待查清单。

---

## 8. 参考

代码与 schema：

- `/Users/allan/workspace/plovr/plovr-grow-issue-99/prisma/schema.prisma`
  - `Order` 模型：行 198-251
  - `Payment` 模型：行 677-716
  - `IntegrationConnection`：行 842-868
  - `ExternalIdMapping`：行 870-888
  - `WebhookEvent`：行 913-936
- `/Users/allan/workspace/plovr/plovr-grow-issue-99/src/types/index.ts`
  - `OrderMode` / `OrderStatus` / `FulfillmentStatus` / `SalesChannel`：行 89-106
  - `OrderItemData`：行 108-119
  - `SelectedModifier`：行 33-40
- `/Users/allan/workspace/plovr/plovr-grow-issue-99/src/services/order/order.types.ts`
  - `OrderData`：行 13-47
- `/Users/allan/workspace/plovr/plovr-grow-issue-99/src/services/order/order-events.types.ts`
  - `OrderEventType` / `OrderCreatedEvent` / `OrderPaidEvent`：全文件
- `/Users/allan/workspace/plovr/plovr-grow-issue-99/src/services/square/square.types.ts`
  - `SquareOrderPushInput` / `FULFILLMENT_STATUS_MAP` / `REVERSE_FULFILLMENT_STATUS_MAP` / `SquareWebhookPayload`
- `/Users/allan/workspace/plovr/plovr-grow-issue-99/src/services/square/square-order.service.ts`
- `/Users/allan/workspace/plovr/plovr-grow-issue-99/src/services/square/square-order-listener.ts`
- `/Users/allan/workspace/plovr/plovr-grow-issue-99/src/services/square/square-webhook.service.ts`
- `/Users/allan/workspace/plovr/plovr-grow-issue-99/src/app/api/integration/square/webhook/route.ts`

设计文档：

- `/Users/allan/workspace/plovr/plovr-grow-issue-99/docs/superpowers/specs/2026-04-08-square-integration-design.md`
- `/Users/allan/workspace/plovr/plovr-grow-issue-99/docs/superpowers/specs/2026-04-09-square-webhook-design.md`
- `/Users/allan/workspace/plovr/plovr-grow-issue-99/docs/superpowers/plans/2026-04-08-square-integration.md`
- `/Users/allan/workspace/plovr/plovr-grow-issue-99/docs/superpowers/plans/2026-04-09-square-webhook.md`

待查 Square 官方文档（本审计未能直接验证）：

- Square `OrderLineItem.applied_taxes` / `Order.taxes` 结构
- Square `Order.service_charges[]` / `Order.discounts[]` / `Order.tenders[]` 字段集
- Square `Fulfillment.type = SHIPMENT / DELIVERY` 的差异
- Square `Order.state` 与 `Payment.status` 枚举的完整取值
- Square 事件类型清单（尤其是 refund / dispute / invoice）
- Square 订单 `version` 字段的乐观锁语义
