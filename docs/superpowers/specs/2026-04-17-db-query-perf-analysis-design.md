# DB 查询性能分析（/playground + 核心用户流）— Design

- Date: 2026-04-17
- Issue: [#297](https://github.com/plovr-ai/plovr-grow/issues/297)
- Status: Proposed

## 1. 背景

Issue #297 反馈访问 `/playground` 会触发大量 DB 调用，并希望系统性分析各路由的查询次数与合理性、给出优化方案。当前 Prisma 在 dev 下仅 `log: ["query", "error", "warn"]`，无法按请求聚合、无 N+1 检测、生产侧没有 DB 层可观测性。

本设计交付：一份 **dev-only 的 Prisma 请求级仪表** + **一份基于该仪表采集数据的分析报告**。不修改业务代码、不落地优化（优化点转为后续 issue）。

## 2. 目标与非目标

**目标**
- 增加 dev-only 仪表：每个 HTTP 请求输出 `查询数 / 总耗时 / 每条 query 详情 / N+1 告警`。
- 手工采集 5 条目标路由的观测数据。
- 产出逐路由分析报告，包含查询清单、合理性评估、优化建议。

**非目标**
- 不改任何 service / repository / page / API 业务代码。
- 不落地任何优化（所有优化建议转为新 issue）。
- 不接入 OpenTelemetry / APM / 生产侧 tracing。
- 仪表仅 dev 可用，生产侧默认关闭且零开销。

## 3. 交付物

| 产物 | 路径 | 说明 |
|---|---|---|
| 仪表实现 | `src/lib/db-instrumentation.ts`（新） | Prisma `$extends` + per-request 聚合 Map + 空闲 flush + N+1 检测 |
| 仪表接入 | `src/lib/db.ts`（改） | 仅当 `process.env.DB_PERF_LOG === "1"` 时用 `.$extends` 包一层；否则原样 export 原 prisma |
| 请求标记 | `src/middleware.ts`（新） | flag 开启时为每个请求注入 `x-db-perf-req` / `x-db-perf-route` header |
| 分析报告 | `docs/superpowers/specs/2026-04-17-db-query-perf-analysis-report.md` | 5 条路由的查询清单 + 合理性评估 + 优化建议 |

5 条目标路由：
1. `/playground`
2. `/[companySlug]`（storefront 品牌首屏）
3. `/r/[merchantSlug]/menu`
4. `/r/[merchantSlug]/cart`
5. `/r/[merchantSlug]/checkout`

## 4. 仪表设计

### 4.1 整体数据流

```
incoming request
   ↓
middleware.ts  (flag on?) — 注入 x-db-perf-req / x-db-perf-route 请求 header
   ↓
page / API route 渲染，调用 service → prisma.<op>
   ↓
Prisma $extends 拦截每条 query：
   - 通过 `next/headers` 读取 x-db-perf-req / x-db-perf-route
   - push 到 Map<requestId, DbPerfStore>
   - 重置该 request 的 300ms 空闲 flush 定时器
   ↓
定时器触发 → 格式化并打印 summary → 从 Map 移除
```

**为何用 middleware + `headers()` 而非 AsyncLocalStorage？**
Next.js App Router 在 Server Components 渲染期间没有稳定的"请求开始/结束"钩子；但 Next 自己用 internal ALS 驱动 `next/headers`。在 middleware 里注入请求 header、在 Prisma 扩展里通过 `headers()` 读取，等价于借用 Next 的请求 scope，不需要我们自己管理 ALS。

### 4.2 Request-scoped store（进程内 Map）

```ts
type DbPerfStore = {
  requestId: string;
  route: string;                 // e.g. "GET /playground"
  firstQueryAt: number;          // performance.now()
  queries: Array<{
    model: string;               // e.g. "MenuItem"
    op: string;                  // e.g. "findMany"
    durationMs: number;
  }>;
  flushTimer: NodeJS.Timeout;
};

const stores = new Map<string, DbPerfStore>();
```

进程内内存，dev-only，flag 关闭时整个模块不会被加载。

### 4.3 Prisma 扩展

```ts
prisma.$extends({
  query: {
    $allOperations: async ({ model, operation, args, query }) => {
      const start = performance.now();
      try {
        return await query(args);
      } finally {
        const duration = performance.now() - start;
        recordQuery({ model: model ?? "raw", op: operation, durationMs: duration });
      }
    },
  },
});
```

`recordQuery` 内部：
1. `const h = await headers();` — 包 try/catch，若抛（非请求上下文）则丢到 `"unknown"` bucket。
2. 读取 `x-db-perf-req` / `x-db-perf-route`，若 req id 缺失也走 `"unknown"`。
3. 定位或创建 `DbPerfStore`，push query，reset flush timer 至 300ms 后触发 `flushStore(requestId)`。

**格式**：
```
[db-perf] GET /playground req_a1b2c3  queries=8  total=42.3ms
  1. Merchant.findUnique         2.1ms
  2. Menu.findMany               4.8ms
  3. MenuCategory.findMany      18.2ms  ← slowest
  4. MenuItemTaxConfig.findMany  5.6ms
  5. TaxConfig.findMany          3.4ms
  6. MerchantTaxRate.findMany    2.8ms
  7. FeaturedItem.findMany       2.9ms
  8. MenuItemTaxConfig.findMany  2.5ms
  ⚠ N+1 suspect: MenuItemTaxConfig.findMany ×2 (consider merging)
```

### 4.4 N+1 告警规则

同一 request 内，若同一 `${model}.${operation}` 对出现 **≥3 次** 且耗时的变异系数 (stddev / mean) 小于 0.5（即耗时相近，典型 N+1 特征），在汇总末尾以 `⚠ N+1 suspect` 行提示。阈值 3 而非 2 是为了避免误报合理的两次分批查询。

### 4.5 开关与零开销保证

`src/lib/db.ts` 的新逻辑（runtime 条件分支，无 dynamic import）：

```ts
import { PrismaClient, Prisma } from "@prisma/client";
import { maybeAttachDbPerf } from "./db-instrumentation";

export type DbClient = PrismaClient | Prisma.TransactionClient;

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

const base =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

// 仅当 DB_PERF_LOG=1 时附加扩展；否则 maybeAttachDbPerf 直接 return base
const prisma = maybeAttachDbPerf(base);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = base;

export default prisma;
```

`maybeAttachDbPerf` 第一行即 `if (process.env.DB_PERF_LOG !== "1") return client;`，未开启时零调用开销；开启时返回 `client.$extends(...)` 的包装。`middleware.ts` 同样用 `DB_PERF_LOG !== "1" ? NextResponse.next() : <inject headers>` 短路。

### 4.6 Middleware 实现

```ts
// src/middleware.ts
import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  if (process.env.DB_PERF_LOG !== "1") return NextResponse.next();

  const reqId = crypto.randomUUID().slice(0, 8);
  const route = `${req.method} ${req.nextUrl.pathname}`;
  const headers = new Headers(req.headers);
  headers.set("x-db-perf-req", reqId);
  headers.set("x-db-perf-route", route);

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

### 4.7 Fallback

若 `next/headers` 从 Prisma 扩展调用抛错（例如 Prisma 客户端在非请求上下文被初始化/触发），所有查询归入 `"unknown"` bucket，仍每 300ms flush 一次。用户会看到 `[db-perf] <unknown> queries=N ...`，仍可按时间窗口粗略对应到路由。若该路径频繁命中，再调整为 per-query 直打模式（单行每条）。

## 5. 分析报告模板

报告单独成文：`docs/superpowers/specs/2026-04-17-db-query-perf-analysis-report.md`。

每条路由一节，统一结构：

```markdown
## <route>

**触发点**: <page/api file> → <service.method()>

**观测** (DB_PERF_LOG=1, 本地 seed):
- 查询数: N
- 总耗时: X ms
- Top 3: ...

**查询清单**
| # | Model.op | 耗时 | 来源 (service/repo) | 备注 |
|---|---|---|---|---|

**合理性评估**: OK / 可优化

**优化建议**（转新 issue）:
- [ ] <建议 A> — 预计节省 X 次 / Y ms
```

末尾 **"跨路由共性问题 & 优先级建议"** 一节汇总：
- 共性 N+1 模式
- 可全局并行化的 pattern
- 可引入批量 loader / DataLoader 的场景
- 按 "收益/改动量" 排序的优化 roadmap

## 6. 风险与限制

| 风险 | 缓解 |
|---|---|
| 仪表代码本身影响 Prisma 启动 | `maybeAttachDbPerf` 在 flag 关闭时首行 return；middleware 同样短路 |
| `headers()` 在 Prisma 扩展上下文里抛错 | try/catch 归入 `"unknown"` bucket；极端情况降级为 per-query 直打（4.7 Fallback）|
| 本地 seed 数据量不反映生产 | 报告显著标注该限制；所有结论以 "查询次数 / 结构" 而非绝对耗时为主 |
| env flag 泄漏到生产 | 默认不设；报告中的 "如何复现" 明确 `DB_PERF_LOG=1 npm run dev`；PR 描述提示不要在部署环境设置 |
| middleware matcher 影响不相关路由 | matcher 仅排除静态资源；flag 关闭时 middleware 立即 next()，无副作用 |

## 7. 验收

- `DB_PERF_LOG=1 npm run dev`，访问 `/playground`，控制台输出设计中描述格式的汇总 ✓
- 未设 flag 下 `npm run dev` 日志无新增 `[db-perf]` 行 ✓
- `npm run build` 与 `npx tsc --noEmit` 通过 ✓
- 分析报告包含 5 条路由各自章节 + 跨路由共性节 ✓

## 8. 后续

- 每条 "优化建议" 开成独立 issue，按 roadmap 推进。
- 若反馈仪表有价值，另开 issue 讨论生产侧轻量 tracing（可能对接 OTel 或已有 pino logging / monitoring 设计）。
