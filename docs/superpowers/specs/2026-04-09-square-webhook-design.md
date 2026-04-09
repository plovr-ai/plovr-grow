# Square Webhook Handling Design

> Issue: #44 — feat: migrate Square Webhook handling from allinone
> Date: 2026-04-09
> Dependencies: #3 Phase 1 (PR #42), #43 (Square Order Push)

## Overview

实现 Square Webhook 接收和处理，支持签名验证、事件存储、事件路由到对应 handler。采用扁平 Handler 模式，与现有 Stripe webhook 保持一致。

## 数据模型

新增 `WebhookEvent` 表：

```prisma
model WebhookEvent {
  id              String   @id @default(cuid())
  tenantId        String
  merchantId      String
  connectionId    String
  eventId         String          // Square event_id，全局去重
  eventType       String          // e.g. "catalog.version.updated"
  payload         Json            // 完整原始 payload
  status          String   @default("received")  // received | processing | processed | failed
  errorMessage    String?  @db.Text
  processedAt     DateTime?
  createdAt       DateTime @default(now())

  tenant     Tenant               @relation(fields: [tenantId], references: [id])
  merchant   Merchant             @relation(fields: [merchantId], references: [id])
  connection IntegrationConnection @relation(fields: [connectionId], references: [id])

  @@unique([eventId])
  @@index([tenantId, merchantId, eventType])
  @@index([connectionId])
  @@index([status])
}
```

- `eventId` 唯一约束实现幂等性——重复投递直接跳过
- `status` 追踪处理进度，便于排查和重试
- `payload` 存完整 JSON 用于审计和调试
- `merchantId` 保持门店维度，与 `IntegrationConnection` 的 `[tenantId, merchantId, type]` 一致

## API Route

### `POST /api/integration/square/webhook`

请求处理流程：

1. 读取 raw body（`request.text()`，不经过 JSON 解析中间件）
2. 从 header 取 `x-square-hmacsha256-signature`
3. 用 `SQUARE_WEBHOOK_SIGNATURE_KEY` + notification URL + raw body 计算 HMAC-SHA256
4. timing-safe comparison 比对签名
5. 签名通过 → 解析 payload → 交给 `SquareWebhookService`
6. 签名失败 → 返回 401
7. 无论处理结果如何，返回 200（避免 Square 重试风暴）

### Square 签名算法

Square 的签名内容是 **notification URL + raw body** 拼接：

```typescript
const hmac = crypto.createHmac('sha256', SQUARE_WEBHOOK_SIGNATURE_KEY)
hmac.update(notificationUrl + rawBody)
const expected = hmac.digest('base64')
// timing-safe compare with header value
```

## SquareWebhookService

### 核心方法

```typescript
class SquareWebhookService {
  // 入口：验证签名 + 存储 + 路由
  async handleWebhook(tenantId, merchantId, rawBody, signature): Promise<void>

  // 签名验证
  verifySignature(rawBody, signature): boolean

  // 事件路由
  private async routeEvent(event: WebhookEvent): Promise<void>

  // Handler: catalog.version.updated → 全量 re-sync
  private async handleCatalogChange(event): Promise<void>

  // Handler: order.updated → 反查映射 → 更新 fulfillment 状态
  private async handleOrderUpdate(event): Promise<void>

  // Handler: payment.completed / payment.updated → 更新支付状态
  private async handlePaymentEvent(event): Promise<void>
}
```

### 事件处理逻辑

**Catalog Change (`catalog.version.updated`)**：
- 通过 `connectionId` 获取连接信息
- 调用 `SquareCatalogService.syncCatalog(tenantId, merchantId)`
- 现有并发守卫（`getRunningSync`）自动防止重复 sync

**Order Update (`order.updated`)**：
- 从 payload 提取 Square order ID
- 通过 `ExternalIdMapping.getIdMappingByExternalId()` 反查内部 orderId
- 从 payload 提取 fulfillment state，用现有 `FULFILLMENT_STATUS_MAP` 映射
- 更新内部订单状态
- 找不到映射则跳过（非我们系统创建的订单）

**Payment Event (`payment.completed` / `payment.updated`)**：
- 从 payload 提取 Square order ID → 反查内部 orderId
- 更新支付状态（completed/failed）
- 找不到映射则跳过

### 整体流程

```
Webhook 请求到达
  → verifySignature() — 失败返回 401，记录 error 日志
  → 按 eventId 查重 — 已存在则返回 200
  → 查找 IntegrationConnection（by Square merchant ID from payload）
  → 存储 WebhookEvent（status: "received"）
  → routeEvent()
    → 匹配到 handler → 执行 → status: "processed"
    → 未匹配 → status: "processed"（仅存储）
    → handler 抛错 → status: "failed" + errorMessage
  → 返回 200
```

## 错误处理

| 场景 | 行为 | 日志级别 | HTTP 响应 |
|------|------|----------|-----------|
| 签名验证失败 | 不存储事件，记录请求来源 IP 和 event type | error | 401 |
| 重复事件 | 跳过处理 | debug | 200 |
| 找不到 IntegrationConnection | 存储事件，status: "failed" | error | 200 |
| Handler 内部错误 | 更新 status: "failed" + errorMessage | error | 200 |
| ExternalIdMapping 无结果 | 跳过，不视为错误 | info | 200 |

## 安全措施

- **Timing-safe comparison**：`crypto.timingSafeEqual` 防止时序攻击
- **Raw body 处理**：`request.text()` 获取原始字符串，避免 JSON 解析改变签名
- **不暴露内部错误**：响应统一返回 `{ received: true }`

## 配置

### 环境变量（.env.example 新增）

```
SQUARE_WEBHOOK_SIGNATURE_KEY=       # Square Developer Dashboard → Webhooks → Signature Key
SQUARE_WEBHOOK_NOTIFICATION_URL=    # 注册在 Square 的 webhook 回调 URL
```

### square.config.ts 扩展

新增 `webhookSignatureKey` 和 `webhookNotificationUrl` 字段。`assertConfigured()` 不强制 webhook 字段，新增 `assertWebhookConfigured()` 单独校验。

## 处理的事件类型

| Square Event Type | Handler | 行为 |
|-------------------|---------|------|
| `catalog.version.updated` | `handleCatalogChange` | 触发全量 catalog re-sync |
| `order.updated` | `handleOrderUpdate` | 反查内部订单，更新 fulfillment 状态 |
| `payment.completed` | `handlePaymentEvent` | 更新支付状态 |
| `payment.updated` | `handlePaymentEvent` | 更新支付状态 |
| 其他 | — | 仅存储，不处理 |

## 文件清单

```
新增：
  src/app/api/integration/square/webhook/route.ts      — API route
  src/services/square/square-webhook.service.ts         — 核心 service
  src/services/square/__tests__/square-webhook.test.ts  — 单元测试
  prisma/schema.prisma                                  — WebhookEvent 模型

修改：
  src/services/square/square.config.ts                  — 新增 webhook 配置
  src/services/square/square.types.ts                   — 新增 webhook 类型
  src/repositories/integration.repository.ts            — 新增 webhook event CRUD
  .env.example                                          — 新增环境变量
```

## 测试策略

- **单元测试**：签名验证（正确/错误/篡改）、事件路由、每个 handler 逻辑、去重、找不到映射的跳过逻辑
- **集成测试**：完整 webhook 请求 → 数据库验证（WebhookEvent 记录、订单状态变更）
