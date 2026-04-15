# Pino 结构化日志设计

**Issue**: #258
**Date**: 2026-04-15

## 目标

引入 Pino 结构化日志替代 console.log，为生产环境提供可按 tenantId/requestId 检索的 JSON 日志。

## 依赖安装

- `pino` — 生产依赖
- `pino-pretty` — dev 依赖（开发环境可读格式）

## 1. Logger 模块

**路径**: `src/lib/logger/index.ts`

### 全局 logger

```typescript
import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: isProduction ? "info" : "debug",
  ...(isProduction
    ? {}
    : { transport: { target: "pino-pretty", options: { colorize: true } } }),
});
```

### createRequestLogger

```typescript
import { NextRequest } from "next/server";
import { randomUUID } from "crypto";

export function createRequestLogger(req: NextRequest): pino.Logger {
  return logger.child({
    requestId: req.headers.get("x-request-id") ?? randomUUID(),
    method: req.method,
    path: new URL(req.url).pathname,
  });
}
```

- 优先使用请求头中的 `x-request-id`（Vercel 等平台会注入），否则生成 UUID
- 返回 child logger，后续日志自动携带 requestId

## 2. withApiHandler 增强

**文件**: `src/lib/api/with-api-handler.ts`

修改内容：
1. 在 handler 执行前创建 request logger
2. 记录请求开始和结束（含 duration、status code）
3. 替换 `console.error` 为 `reqLogger.error`

```typescript
export function withApiHandler<T extends Record<string, string>>(
  handler: ApiHandler<T>
): ApiHandler<T> {
  return async (req, context) => {
    const reqLogger = createRequestLogger(req);
    const start = Date.now();

    try {
      const response = await handler(req, context);
      reqLogger.info({ duration: Date.now() - start, status: response.status }, "Request completed");
      return response;
    } catch (error) {
      const duration = Date.now() - start;

      if (error instanceof AppError) {
        reqLogger.warn({ duration, code: error.code, status: error.statusCode }, "App error");
        return NextResponse.json(
          { success: false, error: { code: error.code, ...(error.params && { params: error.params }) } },
          { status: error.statusCode }
        );
      }

      reqLogger.error({ err: error, duration }, "Unhandled error");
      return NextResponse.json(
        { success: false, error: { code: ErrorCodes.INTERNAL_ERROR } },
        { status: 500 }
      );
    }
  };
}
```

## 3. 迁移范围

仅迁移 Issue 指定的三个关键领域：

| 领域 | 文件 | console 语句数 |
|------|------|---------------|
| Order | `src/services/order/order-events.ts` | ~3 |
| Payment | `src/services/payment/payment.service.ts` | ~4 |
| Webhook | `src/app/api/webhooks/stripe/route.ts` | ~10 |
| Webhook | `src/app/api/webhooks/stripe-connect/route.ts` | ~4 |
| Webhook | `src/services/square/square-webhook.service.ts` | ~18 |
| Webhook | `src/services/integration/webhook-dispatcher.service.ts` | ~5 |

### 迁移规则

- `console.log` → `logger.info` 或相应的 child logger
- `console.warn` → `logger.warn`
- `console.error` → `logger.error`
- 每个 log 调用添加结构化上下文字段（如 `tenantId`、`orderId`、`eventType`）
- 字符串拼接改为结构化对象：`console.log("Order created:", orderId)` → `logger.info({ orderId }, "Order created")`

## 4. ESLint no-console 规则

**文件**: `eslint.config.mjs`

```javascript
"no-console": "warn"
```

- warn 级别，不阻断构建
- 后续可逐步收紧为 error

## 5. 不做什么

- 不改变 handler 函数签名（不传 logger 参数给业务 handler）
- 不迁移 Issue 范围外的 console 语句
- 不添加 log rotation 或外部 transport
- 不添加 request logger 到业务 handler 上下文（后续 Issue 按需）

## 6. 验证

- 开发环境：`pino-pretty` 彩色可读格式
- 生产环境：JSON 格式，含 `requestId`、`tenantId` 等字段
- 现有测试不受影响（mock logger 或忽略 stdout）
