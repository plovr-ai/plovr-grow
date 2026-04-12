# POS Provider Interface Design

> Issue: #130 — refactor(integration): abstract POS Provider interface for multi-POS extensibility

## 决策摘要

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 重构范围 | 接口 + Registry + Event Listener 改造 | 统一 Webhook Route 单独 issue |
| OAuth 是否纳入接口 | 不纳入 | 各 POS 认证差异大，由各 provider 内部处理 |
| Catalog 返回类型 | 直接返回内部模型 `MappedCatalog` | YAGNI，中间层等第二个 POS 再评估 |
| Event 分发策略 | 按 merchant 查活跃 POS 连接 | 不需要修改 Order 模型 |
| 方法参数签名 | `tenantId + merchantId` | 与现有约定一致 |
| 实现方式 | 轻量 Adapter + Registry | 不改现有 Square 服务内部逻辑 |

## 1. PosProvider 接口

```typescript
// src/services/integration/pos-provider.types.ts

interface PosProvider {
  readonly type: string; // "POS_SQUARE", "POS_TOAST", etc.

  syncCatalog(tenantId: string, merchantId: string): Promise<CatalogSyncResult>;

  pushOrder(tenantId: string, merchantId: string, input: PosOrderPushInput): Promise<PosOrderPushResult>;

  updateFulfillment(tenantId: string, merchantId: string, orderId: string, status: string): Promise<void>;

  cancelOrder(tenantId: string, merchantId: string, orderId: string, reason?: string): Promise<void>;
}
```

标准化类型：
- `CatalogSyncResult` — `{ objectsSynced: number; objectsMapped: number }`
- `PosOrderPushInput` — 从 `SquareOrderPushInput` 提取 POS 无关字段（items, fulfillment, notes 等）
- `PosOrderPushResult` — `{ externalOrderId: string; externalVersion?: number }`

Square 特有字段（如 `locationId`）由 `SquarePosProvider` 内部补充，不暴露在标准接口中。

## 2. PosProviderRegistry

```typescript
// src/services/integration/pos-provider-registry.ts

class PosProviderRegistry {
  private providers = new Map<string, PosProvider>();

  register(provider: PosProvider): void {
    this.providers.set(provider.type, provider);
  }

  getProvider(type: string): PosProvider {
    const provider = this.providers.get(type);
    if (!provider) {
      throw new AppError('POS_PROVIDER_NOT_FOUND', { type });
    }
    return provider;
  }

  hasProvider(type: string): boolean {
    return this.providers.has(type);
  }
}

export const posProviderRegistry = new PosProviderRegistry();
```

注册时机：在 `src/instrumentation.ts` 中，启动时注册所有 provider。

## 3. SquarePosProvider Adapter

```typescript
// src/services/square/square-pos-provider.ts

class SquarePosProvider implements PosProvider {
  readonly type = "POS_SQUARE";

  async syncCatalog(tenantId, merchantId) → 委托 squareService.syncCatalog()
  async pushOrder(tenantId, merchantId, input) → 转换类型后委托 squareOrderService.createOrder()
  async updateFulfillment(tenantId, merchantId, orderId, status) → 委托 squareOrderService.updateOrderStatus()
  async cancelOrder(tenantId, merchantId, orderId, reason) → 委托 squareOrderService.cancelOrder()
}
```

核心原则：adapter 是薄层，只做类型转换和委托。现有 Square 服务内部代码不做任何修改。

## 4. Order Listener 重构

将 `square-order-listener.ts` 重构为 POS 无关的 `order-listener.ts`：

```
内部订单状态变更
  ↓
orderEventEmitter.emit("order.paid" / "order.fulfillment.*" / "order.cancelled")
  ↓
order-listener.ts
  ↓
findActivePosConnection() → registry.getProvider() → provider.pushOrder/updateFulfillment/cancelOrder
  ↓
外部 POS API
```

关键改动：
- `checkSquareConnection()` → `findActivePosConnection()`（按 `category="POS"` 查，不按 type 硬编码）
- `squareOrderService.createOrder()` → `provider.pushOrder()`
- `getOrderForPush()` 逻辑保留，输出转为 `PosOrderPushInput`
- `registerSquareOrderEventHandlers()` → `registerOrderEventHandlers()`

Repository 新增：
```typescript
getActivePosConnection(tenantId: string, merchantId: string): Promise<IntegrationConnection | null>
// WHERE category = "POS" AND status = "active" AND deleted = false
```

## 5. 文件变动

| 操作 | 文件 | 说明 |
|------|------|------|
| 新增 | `src/services/integration/pos-provider.types.ts` | PosProvider 接口 + 标准类型 |
| 新增 | `src/services/integration/pos-provider-registry.ts` | Registry 单例 |
| 新增 | `src/services/square/square-pos-provider.ts` | Adapter |
| 新增 | `src/services/integration/order-listener.ts` | POS 无关的 event listener |
| 修改 | `src/services/integration/index.ts` | 导出新模块 |
| 修改 | `src/services/square/index.ts` | 导出 squarePosProvider |
| 修改 | `src/instrumentation.ts` | 注册 provider + 改用新 listener |
| 修改 | `src/repositories/integration.repository.ts` | 新增 getActivePosConnection() |
| 删除 | `src/services/square/square-order-listener.ts` | 被 order-listener.ts 替代 |

不改动：`square.service.ts`、`square-order.service.ts`、`square-catalog.service.ts`、`square-webhook.service.ts`、`square-oauth.service.ts`。

## 6. 后续 Issue（本次不实现）

1. **统一 Webhook Route** — 单一入口 `/api/integration/webhook`，按 header/path 分发到对应 provider 的 webhook handler
2. **PosProvider 基类抽取** — 接入第二个 POS 时，评估是否需要 abstract class 提取 connection 查询、token refresh 等通用逻辑
3. **Catalog Sync API 路由通用化** — 当前 `/api/integration/square/catalog/sync` 硬编码 Square，改为通用路由
