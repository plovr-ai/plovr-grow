# 基于 Vercel 部署的监控体系设计

> Issue: #255
> Date: 2026-04-15

## 1. 概述

为 Plovr 平台搭建完整的线上监控体系，覆盖错误追踪、性能监控、结构化日志、流量统计、业务监控和告警六个维度。

**设计原则**：低成本（免费 tier 起步）、低运维（全 SaaS）、渐进式接入。

**技术选型**：Sentry + Vercel 原生能力 + Pino 结构化日志。

## 2. 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                      Vercel 平台                         │
│                                                         │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐            │
│  │ Client   │   │ Server   │   │ Cron Jobs │            │
│  │ (React)  │   │ (API/SSR)│   │ (webhook  │            │
│  │          │   │          │   │  retry)   │            │
│  └────┬─────┘   └────┬─────┘   └────┬─────┘            │
│       │              │              │                   │
│       └──────────┬───┴──────────────┘                   │
│                  │                                      │
│          ┌───────▼────────┐                             │
│          │  Sentry SDK    │                             │
│          │  @sentry/nextjs│                             │
│          └───────┬────────┘                             │
│                  │                                      │
│  ┌───────────────┼──────────────────┐                   │
│  │ instrumentation.ts               │                   │
│  │  - Sentry.init()                 │                   │
│  │  - Pino logger setup             │                   │
│  │  - Event handlers                │                   │
│  └──────────────────────────────────┘                   │
│                                                         │
│  Vercel Speed Insights  ·  Vercel Analytics             │
└────────────┬────────────────────┬───────────────────────┘
             │                    │
             ▼                    ▼
        ┌─────────┐        ┌──────────┐
        │ Sentry  │        │ Vercel   │
        │ Cloud   │        │ Dashboard│
        │ - Errors│        │ - Speed  │
        │ - Perf  │        │ - Traffic│
        │ - Alerts│        │          │
        └─────────┘        └──────────┘
```

## 3. Sentry 接入层

### 3.1 SDK 配置文件

`@sentry/nextjs` 需要 3 个配置文件覆盖不同运行时：

| 文件 | 运行时 | 职责 |
|------|--------|------|
| `sentry.client.config.ts` | Browser | 捕获前端 JS 错误、Performance（页面加载、路由切换） |
| `sentry.server.config.ts` | Node.js Server | 捕获 API route / SSR 错误、Server Performance |
| `sentry.edge.config.ts` | Edge (Middleware) | 捕获 Middleware 错误 |

### 3.2 共享配置

三个文件共用一套配置常量，抽到 `src/lib/sentry/config.ts`：

```typescript
// src/lib/sentry/config.ts
export const sentryConfig = {
  dsn: process.env.SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? "development",
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  tracesSampleRate: process.env.VERCEL_ENV === "production" ? 0.2 : 1.0,
  debug: false,
};
```

### 3.3 与 next.config.ts 集成

`@sentry/nextjs` 通过 `withSentryConfig()` 包裹 Next.js config，自动处理：
- Source Map 上传（生产构建时自动上传到 Sentry）
- 自动 instrument Server Components 和 API Routes
- Tunnel route（可选，绕过广告拦截器）

### 3.4 与 withApiHandler 集成

增强现有 `withApiHandler`，在 catch 中添加 Sentry 上下文：

```typescript
catch (error) {
  Sentry.withScope(scope => {
    scope.setTag("tenant_id", tenantId);
    scope.setTag("api_path", req.nextUrl.pathname);
    Sentry.captureException(error);
  });
  // ... 现有的 AppError 处理逻辑不变
}
```

### 3.5 环境变量

| 变量 | 来源 | 说明 |
|------|------|------|
| `SENTRY_DSN` | Sentry 项目设置 | 数据投递地址 |
| `SENTRY_AUTH_TOKEN` | Sentry API Token | 构建时上传 Source Map |
| `SENTRY_ORG` | Sentry org slug | 组织标识 |
| `SENTRY_PROJECT` | Sentry project slug | 项目标识 |
| `VERCEL_ENV` | Vercel 自动注入 | 区分 production/preview/development |
| `VERCEL_GIT_COMMIT_SHA` | Vercel 自动注入 | Release 关联 |

## 4. 结构化日志

### 4.1 技术选型：Pino

| 对比 | console.log | Pino |
|------|------------|------|
| 格式 | 自由文本，不可检索 | JSON 结构化，可按字段过滤 |
| 性能 | 同步阻塞 | 异步，低开销 |
| 上下文 | 手动拼字符串 | child logger 自动携带 tenantId 等 |
| 日志级别 | 无 | trace/debug/info/warn/error/fatal |

### 4.2 Logger 模块

```typescript
// src/lib/logger/index.ts
import pino from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  transport: process.env.NODE_ENV === "development"
    ? { target: "pino-pretty" }
    : undefined,
  base: {
    env: process.env.VERCEL_ENV ?? "development",
    region: process.env.VERCEL_REGION,
  },
});

export { logger };

export function createRequestLogger(context: {
  tenantId?: string;
  merchantId?: string;
  requestId?: string;
  path?: string;
}) {
  return logger.child(context);
}
```

### 4.3 使用方式

**Service 层**：

```typescript
import { createRequestLogger } from "@/lib/logger";

async createOrder(tenantId: string, merchantId: string, input: CreateOrderInput) {
  const log = createRequestLogger({ tenantId, merchantId, path: "order.createOrder" });
  log.info({ input }, "creating order");
  // ... 业务逻辑
  log.info({ orderId: order.id }, "order created");
}
```

**API 层**：`withApiHandler` 自动注入 request logger（requestId、duration）。

### 4.4 迁移策略

1. 先迁移关键 service（order、payment、webhook）
2. 其余按功能模块逐步迁移
3. 添加 ESLint `no-console` rule（warn 级别，逐步收紧）

### 4.5 日志流向

```
Service/API → Pino (JSON stdout) → Vercel Runtime Logs → Vercel Log Drains (可选)
```

Vercel 免费版保留 1 小时日志，Pro 版保留 3 天。后期可配置 Log Drain 延长保留。

## 5. 性能监控与流量统计

### 5.1 Sentry Performance（服务端）

通过 `tracesSampleRate` 控制采样，自动追踪：

| 自动追踪项 | 说明 |
|-----------|------|
| API Route 耗时 | 每个 route handler 的执行时间 |
| DB 查询 | Prisma 查询耗时（通过 `prismaIntegration()`） |
| 外部 HTTP 调用 | Square API、Stripe API、Stytch 等第三方调用耗时 |
| SSR 渲染 | Server Component 渲染时间 |

Prisma Tracing 集成：

```typescript
// sentry.server.config.ts
import * as Sentry from "@sentry/nextjs";
import { prismaIntegration } from "@sentry/nextjs";

Sentry.init({
  ...sentryConfig,
  integrations: [prismaIntegration()],
});
```

### 5.2 Vercel Speed Insights（客户端 Web Vitals）

```typescript
// src/app/layout.tsx
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";

// 在 body 底部添加
<SpeedInsights />
<Analytics />
```

### 5.3 职责分工

| 关注点 | 工具 | 查看位置 |
|--------|------|----------|
| API 响应时间、慢查询 | Sentry Performance | Sentry Dashboard → Performance |
| 第三方 API 调用耗时 | Sentry Performance | Sentry Dashboard → Traces |
| Core Web Vitals | Vercel Speed Insights | Vercel Dashboard → Speed Insights |
| 页面流量/PV/UV | Vercel Analytics | Vercel Dashboard → Analytics |

## 6. 业务监控与告警

### 6.1 业务指标打点

| 指标 | 采集方式 | 说明 |
|------|----------|------|
| 订单创建量 | `Sentry.metrics.increment("order.created")` | 按 tenantId/merchantId 打 tag |
| 支付成功/失败率 | `Sentry.metrics.increment("payment.result", { tags: { status } })` | 区分 success/failed |
| Webhook 处理成功率 | `Sentry.metrics.increment("webhook.processed", { tags: { status } })` | 区分 success/failed/retry |
| Cron Job 执行状态 | Sentry Crons Monitoring | 自动检测 cron 是否按时执行 |

### 6.2 Sentry Crons 监控

```typescript
// app/api/cron/square-webhook-retry/route.ts
import * as Sentry from "@sentry/nextjs";

export async function GET() {
  return Sentry.withMonitor("square-webhook-retry", async () => {
    // ... 现有 cron 逻辑
  }, {
    schedule: { type: "crontab", value: "*/5 * * * *" },
  });
}
```

### 6.3 告警规则

| 告警 | 条件 | 通知方式 | 优先级 |
|------|------|----------|--------|
| 错误激增 | 5 分钟内同类错误 > 10 次 | Email + Slack | P1 |
| 未处理异常 | 任何 unhandled exception | Email | P1 |
| 支付失败率 | 失败率 > 10%（5 分钟窗口） | Email + Slack | P0 |
| Cron 未执行 | 超过 15 分钟未触发 | Email | P2 |
| API 响应慢 | P95 > 3s（5 分钟窗口） | Email | P2 |

### 6.4 Slack 集成

Sentry 免费版即支持 Slack 集成：Settings → Integrations → Slack。告警自动推送到指定 channel。

## 7. 实施分期

### Issue 1：Sentry 基础接入（错误追踪）

**范围**：
- 安装 `@sentry/nextjs`，运行 wizard 初始化
- 创建 3 个 config 文件 + `src/lib/sentry/config.ts`
- `withSentryConfig()` 包裹 `next.config.ts`
- 增强 `withApiHandler` 添加 `Sentry.captureException` + 上下文
- 配置 Vercel 环境变量

**依赖**：无 | **预估改动**：~6 个文件

### Issue 2：结构化日志

**范围**：
- 安装 `pino` + `pino-pretty`
- 创建 `src/lib/logger/index.ts`
- 增强 `withApiHandler` 注入 request logger
- 迁移关键 service 的 console.log → pino
- 添加 ESLint `no-console` rule

**依赖**：无（可与 Issue 1 并行） | **预估改动**：~10 个文件

### Issue 3：性能监控 + 流量统计

**范围**：
- 启用 Sentry Performance tracing + `prismaIntegration()`
- 在 `layout.tsx` 添加 `<SpeedInsights />` 和 `<Analytics />`
- 安装 `@vercel/speed-insights` + `@vercel/analytics`

**依赖**：Issue 1 | **预估改动**：~4 个文件

### Issue 4：业务监控 + 告警

**范围**：
- 在 order/payment/webhook service 添加 Sentry metrics 打点
- 用 `Sentry.withMonitor()` 包裹 cron job routes
- 在 Sentry Dashboard 配置 Alert Rules
- 配置 Slack 集成

**依赖**：Issue 1 + Issue 2 | **预估改动**：~6 个文件

### 时间线

```
Week 1:  Issue 1 (Sentry 接入) ─────┐
         Issue 2 (结构化日志) ──────┤ 并行
                                    │
Week 2:  Issue 3 (性能+流量) ──────┤ 依赖 Issue 1
         Issue 4 (业务+告警) ──────┘ 依赖 Issue 1+2
```

## 8. 成本预估

| 服务 | 免费 Tier | 超出后 |
|------|-----------|--------|
| Sentry | 5K errors/月, 10K transactions/月 | Team $26/月 |
| Vercel Analytics | 2.5K events/月 | Pro plan 含无限 |
| Vercel Speed Insights | 10K 数据点/月 | Pro plan 含无限 |
| Pino | 开源免费 | - |

初期免费 tier 足够覆盖。随业务增长可按需升级。
