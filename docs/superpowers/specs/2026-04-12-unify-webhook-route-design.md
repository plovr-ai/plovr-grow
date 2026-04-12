# Unify Webhook Route for Multi-POS Dispatch

**Issue**: #139  
**Date**: 2026-04-12  
**Status**: Approved

## Background

当前每个 POS 有独立的 webhook route（如 `/api/integration/square/webhook`），通用逻辑（签名验证流程、事件去重、connection 查找、状态跟踪）嵌在各自的 service 中。接入新 POS 时需要重复编写这些逻辑。

## Design

### 1. PosWebhookProvider 接口

```typescript
// src/services/integration/pos-webhook-provider.interface.ts

interface PosWebhookProvider {
  /** 验证 webhook 签名，各 POS 实现自己的算法 */
  verifyWebhook(rawBody: string, headers: Record<string, string>): boolean;

  /** 从原始 payload 中提取标准化的事件信息 */
  parseWebhookEvent(rawBody: string): ParsedWebhookEvent;

  /** 处理具体的 webhook 事件 */
  handleWebhookEvent(event: ParsedWebhookEvent): Promise<void>;
}

interface ParsedWebhookEvent {
  eventId: string;           // 用于去重
  eventType: string;         // 标准化事件类型
  externalAccountId: string; // 用于查找 connection
  rawPayload: unknown;       // 原始数据保留
}
```

### 2. WebhookDispatcherService

```typescript
// src/services/integration/webhook-dispatcher.service.ts

class WebhookDispatcherService {
  private providers: Map<string, PosWebhookProvider>;

  register(name: string, provider: PosWebhookProvider): void;

  async dispatch(providerName: string, rawBody: string, headers: Record<string, string>): Promise<void> {
    // 1. 查找 provider（未找到 → 400）
    // 2. 验证签名 → provider.verifyWebhook(rawBody, headers)（失败 → 401）
    // 3. 解析事件 → provider.parseWebhookEvent(rawBody)
    // 4. 去重检查 → integrationRepository.findWebhookEventByEventId(event.eventId)
    // 5. 查找 connection → integrationRepository.getConnectionByExternalAccountId(externalAccountId, providerType)
    // 6. 创建事件记录 → integrationRepository.createWebhookEvent(...)
    // 7. 处理事件 → provider.handleWebhookEvent(event)
    // 8. 更新状态 → PROCESSED / FAILED
  }
}
```

通用逻辑（步骤 4-6, 8）从现有 `SquareWebhookService.handleWebhook()` 中上提到此处。

### 3. Square 适配

```typescript
// src/services/square/square-webhook-provider.ts

class SquareWebhookProvider implements PosWebhookProvider {
  verifyWebhook(rawBody, headers) {
    // 现有 HMAC-SHA256 验证逻辑（从 SquareWebhookService.verifySignature 迁移）
    // 从 headers 中取 x-square-hmacsha256-signature
  }

  parseWebhookEvent(rawBody): ParsedWebhookEvent {
    // 将 Square 格式 { merchant_id, event_id, type, data }
    // 映射为标准 ParsedWebhookEvent
  }

  handleWebhookEvent(event) {
    // 现有 routeEvent 逻辑：
    // - catalog.version.updated → catalog sync
    // - order.updated → fulfillment status
    // - payment.completed / payment.updated → payment status
  }
}
```

### 4. 统一路由

```typescript
// src/app/api/integration/webhook/[provider]/route.ts

export async function POST(req, { params }) {
  const { provider } = await params;
  const rawBody = await req.text();
  const headers = Object.fromEntries(req.headers.entries());

  await webhookDispatcher.dispatch(provider, rawBody, headers);
  return NextResponse.json({ success: true });
}
```

URL 示例：`POST /api/integration/webhook/square`

## File Changes

### 新增

| 文件 | 说明 |
|------|------|
| `src/services/integration/pos-webhook-provider.interface.ts` | 接口 + ParsedWebhookEvent 类型 |
| `src/services/integration/webhook-dispatcher.service.ts` | 通用调度服务 |
| `src/services/square/square-webhook-provider.ts` | Square 实现 PosWebhookProvider |
| `src/app/api/integration/webhook/[provider]/route.ts` | 统一动态路由 |

### 删除

| 文件 | 说明 |
|------|------|
| `src/app/api/integration/square/webhook/route.ts` | 旧 Square webhook 路由 |
| `src/app/api/integration/square/webhook/__tests__/route.test.ts` | 旧路由测试 |

### 修改

| 文件 | 说明 |
|------|------|
| `src/services/square/square-webhook.service.ts` | 剥离通用逻辑（去重、connection 查找、状态跟踪），保留 Square 特有逻辑供 provider 调用 |

## Design Decisions

1. **Path 参数分发**（`/webhook/[provider]`）而非 header 自动检测——每个 POS 注册 webhook 时指定 URL，最可靠
2. **接口 + 注册表**而非继承——符合项目现有 `SmsProvider`、`PaymentProvider` 模式
3. **ParsedWebhookEvent 中间层**——让去重、connection 查找等通用逻辑可以在 dispatcher 中统一处理
4. **直接删除旧路由**——不做兼容过渡，Square webhook URL 需要同步更新
