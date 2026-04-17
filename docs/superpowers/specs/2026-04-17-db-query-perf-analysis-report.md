# DB 查询性能分析报告

- Date: 2026-04-17
- Issue: [#297](https://github.com/plovr-ai/plovr-grow/issues/297)
- Design spec: [`2026-04-17-db-query-perf-analysis-design.md`](./2026-04-17-db-query-perf-analysis-design.md)
- Instrumentation: `src/lib/db-instrumentation.ts` (dev-only, gated on `DB_PERF_LOG=1`)

## 数据来源与注意事项

- **环境**: 本地开发 (`DB_PERF_LOG=1 npm run dev`) + 本地 seed 数据（租户 `burger-shack` / 商户 `burger-shack-main`）。
- **采集方式**: 本报告观测通过 **fallback 模式** 采集。`src/proxy.ts` 的 matcher **未扩大**（仍保持 `/dashboard/:path*` + `/admin/:path*`），因此 5 条目标路由（`/playground`、`/{companySlug}`、`/r/.../menu|cart|checkout`）的请求**不会被 proxy 注入 `x-db-perf-req` header**。仪表在读不到 header 时会走 fallback 分桶：每条 query 归入一个 `unk_N` bucket，一旦连续 >300ms 没有新 query 即滚动下一个编号。
- **测量**: 每条路由用 `curl` 发起，**相邻 curl 间隔 ≥ 1.5s**，让 300ms 的空闲 flush 为每次请求形成独立 bucket。bucket 以 `unk_N` 递增编号，N 与 curl 顺序一一对应。每条路由访问 2 次（1 次 cold 编译 + 1 次 warm）；查询数与结构完全稳定，报告中的耗时使用 warm-cache 均值。
- **结论优先级**: **查询次数 > 查询结构 > 绝对耗时**。本地 MySQL、seed 体量、无网络延迟，绝对耗时不可直接外推到生产；但相对大小关系与 N+1 结构可以。
- **Prisma `include`**: Prisma ORM 把 `include` 编译成多条独立 SQL（而非 JOIN），所以 `getBySlugWithTenant` 会同时出现 `Merchant.findFirst` + `Tenant.findUnique`。
- **仪表开销**: `DB_PERF_LOG=1` 时 `$extends` hook 在每条 query 上增加 ~μs 级别时长（可忽略）；`flag` 未设置时零开销（模块首行即 return）。

## 路由概览

| 路由 | 查询数 | 总耗时 (warm) | 疑似 N+1 | 评估 |
|------|------:|------:|---|---|
| `/playground` | 8 | ~36ms | 无 | **可优化**（3 条可合并 / 并行） |
| `/{companySlug}` | 6 | ~32ms | `Tenant.findUnique ×4` | **可优化**（租户查询重复） |
| `/r/{merchantSlug}/menu` | 11 | ~46ms | `Merchant.findFirst ×4` | **可优化**（商户查询重复 4 次） |
| `/r/{merchantSlug}/cart` | 2 | ~16ms | 无 | **可优化**（layout 级商户查询重复 2 次） |
| `/r/{merchantSlug}/checkout` | 2 | ~16ms | 无 | **可优化**（同上） |

---

## `/playground`

**触发点**: `src/app/(website)/playground/page.tsx` → `menuService.getMenu(tenantId, merchantId)`。

**观测** (warm, 3 次平均):
- 查询数: **8**
- 总耗时: ~36ms
- Top 3 (warm 1): `MenuCategory.findMany` (12.1ms), `Merchant.findUnique` (8.5ms), `Menu.findMany` (8.3ms)

**查询清单**

| # | Model.op | 耗时 (warm 1) | 来源 | 备注 |
|---|---|---:|---|---|
| 1 | `Menu.findMany` | 8.3ms | `menuEntityRepository.getMenusByCompany` | ✅ 与 Merchant 并行（`Promise.all`）|
| 2 | `Merchant.findUnique` | 8.5ms | `merchantRepository.getById` | ✅ 与 Menu 并行 |
| 3 | `MenuCategory.findMany` | 12.1ms | `menuRepository.getCategoriesWithItemsByMenu` | 最慢，含 `include` 嵌套 items |
| 4 | `MenuItemTax.findMany` | 1.8ms | `taxConfigRepository.getMenuItemsTaxConfigIds` | 第 1 次：查分类条目的税配置 |
| 5 | `TaxConfig.findMany` | 1.6ms | `taxConfigRepository.getTaxConfigsByIds` | ✅ 与 MerchantTaxRate 并行 |
| 6 | `MerchantTaxRate.findMany` | 1.6ms | `taxConfigRepository.getMerchantTaxRateMap` | ✅ 与 TaxConfig 并行 |
| 7 | `FeaturedItem.findMany` | 1.4ms | `featuredItemRepository.getByTenantId` | 只在 "first menu" 分支执行 |
| 8 | `MenuItemTax.findMany` | 0.7ms | `taxConfigRepository.getMenuItemsTaxConfigIds` | 第 2 次：**仅查 featured items 的税配置** |

**合理性评估**: **可优化**。

`getMenu()` 已经做了显著优化（`Promise.all` 并行 3 对查询），但仍有两处结构性浪费：

1. **Query 4 + Query 8 可以合并为一次** — 两次调用 `getMenuItemsTaxConfigIds`，第一次传分类下的 itemIds，第二次传 featured 下的 itemIds。featured 的 itemIds 其实已经在 seed 的 DB 里，从分类返回结果里也能拿到（或一次性合并后查）。
2. **Query 7 (FeaturedItem) 可与 Query 3 (MenuCategory) 并行** — 当前代码先等 categories 解析完 itemIds 才触发 featured fetch。在业务逻辑上这两者完全独立（featured 是独立的 tenant 级表），应并入外层 `Promise.all`。

**优化建议**（转新 issue）:
- [ ] **合并两次 `MenuItemTax.findMany`**：让 `getMenu()` 一次性把 `allItemIds = categoryItemIds ∪ featuredItemIds` 传给 `getMenuItemsTaxConfigIds`。预计节省 1 次查询。
- [ ] **并行 `FeaturedItem.findMany` 与 `MenuCategory.findMany`**：把 `featuredItemRepository.getByTenantId(tenantId)` 提升到和 categories 同级的 `Promise.all`。预计节省 ~2ms 串行等待。
- [ ] **（低优先）将 tax enrichment 完全消除**：添加一个一次性聚合 query `getMenuItemsWithTaxesByMenuId(tenantId, menuId)`，在 SQL 层 JOIN menu_item_tax + tax_config + merchant_tax_rate，取代 #4/5/6/8 四条 query。改动较大但可把 `/playground` 降到 3-4 条 query。

---

## `/{companySlug}` （Storefront 品牌首页）

**触发点**: `src/app/(storefront)/[companySlug]/page.tsx`
- `merchantService.getTenantBySlug(companySlug)` → `tenantRepository.getBySlugWithMerchants` (1 query, 但产生 Tenant + Merchant 两条)
- `merchantService.getTenantWebsiteData(companySlug)` → 再次 `tenantRepository.getBySlugWithMerchants` + `menuService.getFeaturedItems`
- `loyaltyConfigService.isLoyaltyEnabled(tenantId)` → `loyalty_configs.findFirst`

**观测** (warm, 2 次平均):
- 查询数: **6**
- 总耗时: ~32ms
- N+1 告警: `Tenant.findUnique ×4 (mean=6.7ms, cv=0.26)`

**查询清单**

| # | Model.op | 耗时 | 来源 | 备注 |
|---|---|---:|---|---|
| 1 | `Tenant.findUnique` | 7.3ms | `tenantRepository.getBySlugWithMerchants`（`getTenantBySlug`） | 第 1 次 |
| 2 | `Tenant.findUnique` | 7.3ms | 同上（Prisma include 的二次 query） | **重复** |
| 3 | `Tenant.findUnique` | 5.1ms | `getTenantWebsiteData` 里再次 `getTenantBySlug` | **调用重复** |
| 4 | `Tenant.findUnique` | 4.4ms | 同 #3 的 include 二次 query | **重复** |
| 5 | `FeaturedItem.findMany` | 1.5ms | `menuService.getFeaturedItems` | OK |
| 6 | `LoyaltyConfig.findFirst` | 3.7ms | `loyaltyConfigService.isLoyaltyEnabled` | OK，但可并行 |

注：`#1`/`#3` 是真正的 tenant 查询；`#2`/`#4` 是 Prisma 对 `include: { merchants: ... }` 的嵌套 fetch（Prisma 不用 JOIN）。即便如此，**整个请求内 `getTenantBySlug` 被串行调用了两次**，这是最明显的浪费。

**合理性评估**: **可优化**。

`CompanyHomePage` 先 `getTenantBySlug` 再 `getTenantWebsiteData`，而后者内部又调了 `getTenantBySlug`。第一次的返回值被忽略了。另外 `isLoyaltyEnabled` 与这两个调用是串行的，明显可并行。

**优化建议**（转新 issue）:
- [ ] **消除 `getTenantBySlug` 的重复调用**：让 `getTenantWebsiteData` 接受一个可选的 `preloadedTenant`，或者在 page 里只调一次、把结果传给两边。预计节省 2 条 query（约 10ms）。
- [ ] **并行化 `isLoyaltyEnabled`**：用 `Promise.all` 把 tenant 取回 + loyalty 判断并行。预计节省 ~4ms。
- [ ] **（低优先）把 loyalty 的启用状态塞进 `tenant.settings` JSON 字段**：从此无需单独的 `loyalty_configs.findFirst`。需要先评估是否有其他 loyalty 配置字段需独立存储。

---

## `/r/{merchantSlug}/menu`

**触发点**:
- Layout: `src/app/(storefront)/r/[merchantSlug]/layout.tsx`
  - `generateMetadata` → `merchantService.getWebsiteData(slug)` → `getMerchantBySlug` (1 call)
  - `MerchantLayout` → `merchantService.getMerchantBySlug(slug)` (**又一次 call**)
- Page: `src/app/(storefront)/r/[merchantSlug]/menu/page.tsx`
  - `merchantService.getMerchantBySlug(slug)` (**又一次 call**)
  - `menuService.getMenu(tenantId, merchantId, menuId, { preloadedMerchant })`
  - `menuService.countActiveItemsByMenuIds` / `countActiveFeaturedItems` 视情况

**观测** (warm, 2 次平均):
- 查询数: **11**
- 总耗时: ~46ms
- N+1 告警: `Merchant.findFirst ×4 (mean=7.2ms, cv=0.30)`

**查询清单**

| # | Model.op | 耗时 | 来源 | 备注 |
|---|---|---:|---|---|
| 1 | `Merchant.findFirst` | 10.2ms | layout `generateMetadata` 里的 `getWebsiteData` → `getMerchantBySlug` | 第 1 次 slug 查商户 |
| 2 | `Merchant.findFirst` | 6.8ms | layout 本体 `MerchantLayout` → 再次 `getMerchantBySlug` | **重复** |
| 3 | `Merchant.findFirst` | 7.2ms | page → `getMerchantBySlug` | **重复** |
| 4 | `Merchant.findFirst` | 3.7ms | **未定位到精确来源**（另一次 layout/page 分支，本地测观察到一致 4 次）| 推测来自 `getWebsiteData` 内部再次 `getMerchantBySlug` 或 preloaded 未完全生效 |
| 5 | `Menu.findMany` | 2.6ms | `menuService.getMenu` → `getMenusByCompany` | OK（`Promise.all` 并行) |
| 6 | `MenuCategory.findMany` | 7.2ms | `menuRepository.getCategoriesWithItemsByMenu` | OK |
| 7 | `MenuItemTax.findMany` | 1.7ms | `taxConfigRepository.getMenuItemsTaxConfigIds` | 第 1 次 |
| 8 | `TaxConfig.findMany` | 1.2ms | `getTaxConfigsByIds` | OK（并行） |
| 9 | `MerchantTaxRate.findMany` | 1.3ms | `getMerchantTaxRateMap` | OK（并行） |
| 10 | `FeaturedItem.findMany` | 2.2ms | `featuredItemRepository.getByTenantId` | OK |
| 11 | `MenuItemTax.findMany` | 1.1ms | 第 2 次（featured 分支）| 与 #7 同一优化点 |

注意：`MenuCategory.findMany` 带了 Prisma `include`，本地仪表只看到一条 parent query（子 item fetch 可能通过 Prisma 的 `include` 合并成一条 SQL），因此 11 查询中未重复出现 `MenuItem.findMany`。

**合理性评估**: **可优化**。

核心问题：**每次请求里同一 merchant 被按 slug 查了 4 次**。`menuService.getMenu` 已经接受 `preloadedMerchant` 参数来避免 1 次 by-id 查询，但 layout 与 page 各自独立调用 `getMerchantBySlug`，没有共享。

**优化建议**（转新 issue）:
- [ ] **请求级缓存 merchant by slug**（高 ROI）：在 Next.js request scope 内用 React `cache()` 或自建 `per-request cache`（基于 `next/headers` 作为 key）。`MerchantLayout` + `MenuPage` + `generateMetadata` 共用同一次 `getMerchantBySlug` 结果。预计节省 3 条 query（约 20ms warm）。
- [ ] **`getWebsiteData` 去除对 `getMerchantBySlug` 的重复调用**：让 `MerchantLayout` 把已取到的 merchant 传给 `getWebsiteData`（或直接 inline）。
- [ ] **继承 `/playground` 的 tax 合并建议**：#7 + #11 合并，减 1 条 query。

---

## `/r/{merchantSlug}/cart`

**触发点**: Cart 页面本身是 `"use client"`，不做 SSR DB 查询。所有 2 条查询都来自 **layout** (`MerchantLayout.tsx` + `generateMetadata`)。

**观测** (warm):
- 查询数: **2**
- 总耗时: ~16ms

**查询清单**

| # | Model.op | 耗时 | 来源 | 备注 |
|---|---|---:|---|---|
| 1 | `Merchant.findFirst` | 9.5ms | layout `generateMetadata` → `getWebsiteData` → `getMerchantBySlug` | 第 1 次 |
| 2 | `Merchant.findFirst` | 6.0ms | layout 本体 `MerchantLayout` → `getMerchantBySlug` | **重复** |

**合理性评估**: **可优化**。

Client-only 页面里 SSR 只需 provider context。但 layout 仍把同一 slug 查两次。没出现 `Tenant` 查询是因为 `cart` 不需要 tenant website data 的 logo。

**优化建议**（转新 issue）:
- [ ] 与 `/r/.../menu` 相同：**共享 `/r/...` layout 层的 `getMerchantBySlug` 结果**。修一处覆盖 `menu`/`cart`/`checkout`/`catering` 等所有子路由。
- [ ] **评估是否可把 cart/checkout 从 MerchantLayout 下拆出**：这两页是 client-only，其实只需要 `companySlug`（用于 navigation），不需要 `MerchantProvider` 全量 config。若业务上可以，彻底去掉这 2 条 query。

---

## `/r/{merchantSlug}/checkout`

**触发点**: 同 cart，client-only 页面；所有查询来自 layout。

**观测** (warm):
- 查询数: **2**
- 总耗时: ~16ms

**查询清单**

| # | Model.op | 耗时 | 来源 | 备注 |
|---|---|---:|---|---|
| 1 | `Merchant.findFirst` | 7.9ms | layout `generateMetadata` → `getMerchantBySlug` | 第 1 次 |
| 2 | `Merchant.findFirst` | 5.1ms | layout `MerchantLayout` → `getMerchantBySlug` | **重复** |

**合理性评估**: **可优化**，同 cart。

**优化建议**（转新 issue）:
- [ ] 共用 merchant-by-slug 的 request cache（同上，一个 issue 覆盖）。

---

## 跨路由共性问题 & 优先级建议

### 共性 1：**"同一实体按 slug/ID 在单次请求里被查多次"**（最高价值）

触及路由：`/{companySlug}` (4× `Tenant`)、`/r/.../menu` (4× `Merchant`)、`/r/.../cart` (2× `Merchant`)、`/r/.../checkout` (2× `Merchant`)。

**根因**：Next.js App Router 里 `generateMetadata`、`layout.tsx`、`page.tsx` 各自是独立的 async server function，缺少共享的 request-scope 缓存，每层独立调 service。

**推荐方案（选一）**：

1. **React `cache()`**（官方推荐）：在 `merchantService.getMerchantBySlug`、`merchantService.getTenantBySlug` 外包一层 `cache()`。Next.js 保证同一请求 deduplicate。侵入性最小。
2. **Repository 层请求缓存**：在 `prisma.ts` 的 `$extends` 里加 `result` 层 memoize（key=model+unique where）。侵入性大。
3. **Page/Layout 显式传参**：扩展 `preloadedMerchant` 模式到 tenant 和 layout 的所有 consumer。侵入性最大。

收益/改动量排序：**方案 1 > 方案 2 > 方案 3**。方案 1 估算改动 < 10 行，预计减少 50%+ 重复 query。

### 共性 2：**Tax / Featured 的双次 lookup**

`/playground` 和 `/r/.../menu` 都在 `menuService.getMenu()` 里两次调 `taxConfigRepository.getMenuItemsTaxConfigIds`（一次给 categories，一次给 featured），完全可合并。

**方案**：重构 `getMenu()` 在入口处先把 all item ids (categories + featured) 合并，一次 `getMenuItemsTaxConfigIds` + 一次 `getTaxConfigsByIds`。

### 共性 3：**`/r/.../cart` 和 `/r/.../checkout` 的 layout 包装过重**

这两页是纯 client 页面，layout 里的 `MerchantProvider` 配置大部分（timezone / currency / tipConfig）只在结算时才需要；cart 页面用不到那么多。

**方案**（需先和产品/前端对齐）：把 `MerchantProvider` 的数据拆成 essential（slug/name/companySlug）+ deferred（tip/fee）。cart 仅需 essential；checkout 需要全量。可将 deferred 部分改为在 checkout 组件内用 `use()`/客户端 fetch 延迟获取。

### 共性 4：**`isLoyaltyEnabled` 这种 boolean 查询没必要走独立表**

`LoyaltyConfig.findFirst` 只是为判断一个 `status === "active"`。若把 `loyaltyEnabled: boolean` 合并进 `tenant.settings` JSON，可在 `getTenantBySlug` 的结果里顺带拿到，省一条 query + 省一次并发等待。

### 优化 Roadmap（按 payoff / effort 排序）

| 优先级 | 优化 | 受益路由 | 预计减少 query | 改动量 | 建议 |
|---|---|---|---:|---|---|
| **P0** | React `cache()` 包装 `getMerchantBySlug` + `getTenantBySlug` | menu, cart, checkout, companySlug | 4-7/请求 | 极小 | 立刻做 |
| **P0** | `getTenantWebsiteData` 去除对 `getTenantBySlug` 的重复调用 | companySlug | 2 | 小 | 立刻做 |
| **P1** | `menuService.getMenu()` 合并两次 tax lookup + 并行 featured | playground, menu | 1-2 | 小 | 第二批 |
| **P1** | `getWebsiteData` 接受 preloadedMerchant | menu, cart, checkout | 1 | 小 | 若 P0 方案 1 已覆盖则可跳过 |
| **P2** | loyalty status 合并进 tenant.settings | companySlug | 1 | 中（需 migration） | 有 migration 成本，延后 |
| **P2** | cart/checkout layout 数据拆分 | cart, checkout | 2 | 中（前端改造） | 需与 UX 对齐 |
| **P3** | `getMenu` 端到端聚合 query（JOIN tax + item + merchant_rate） | playground, menu | 3-4 | 大（要写 raw SQL 或 Prisma 聚合） | 收益最大但改动最大 |

**预期组合收益**（P0+P1 全做）：
- `/playground`: 8 → 6-7 queries
- `/{companySlug}`: 6 → 3 queries（省 4 次 tenant + 1 次 loyalty 并行）
- `/r/.../menu`: 11 → 6-7 queries（省 3 次 merchant + 1 次 tax）
- `/r/.../cart`: 2 → 1 query
- `/r/.../checkout`: 2 → 1 query

## 附录：如何复现

```bash
DB_PERF_LOG=1 npm run dev
# 另一终端：每条 curl 之间至少 1.5s 间隔，让 fallback bucket 可以滚动。
curl --noproxy '*' http://localhost:3000/playground                         && sleep 2 \
 && curl --noproxy '*' http://localhost:3000/burger-shack                   && sleep 2 \
 && curl --noproxy '*' http://localhost:3000/r/burger-shack-main/menu       && sleep 2 \
 && curl --noproxy '*' http://localhost:3000/r/burger-shack-main/cart       && sleep 2 \
 && curl --noproxy '*' http://localhost:3000/r/burger-shack-main/checkout
```

server stdout 会每 300ms 空闲后 flush 一个形如 `[db-perf] (no route header — sequential curl assumed) req_unk_N queries=X total=Y ms` 的块，附带每条 query 的 `Model.op` 与 duration。`unk_N` 的 N 与上面 curl 的顺序一一对应：`unk_1 = /playground`、`unk_2 = /{companySlug}`、`unk_3 = /r/.../menu`、`unk_4 = /r/.../cart`、`unk_5 = /r/.../checkout`。

**注意**：
- 不要在生产/预发环境设置 `DB_PERF_LOG=1`。仪表会为每条 query 调用 `next/headers`，虽然开销小但属于 dev 观测，不应出现在生产流量路径。
- 本仪表 **不修改** 现有 `src/proxy.ts` / middleware 的 matcher 配置。路由标签通过 "curl 顺序 + 300ms 空闲 flush 分桶" 间接推断；只要不并发 curl、间隔充分 (> 300ms)，每次请求都能落在独立 bucket 里。
- 若将来需要 per-request 精确 route 标签，可在 `instrumentation.ts` 的 `register()` 中用 OpenTelemetry 挂钩（开独立 issue），或在开发辅助脚本里把路由名写入 `DB_PERF_ROUTE` 环境变量供仪表读取——两种方案都不需要改 proxy。

## 附录：仪表限制

- `MenuCategory.findMany` + `include: { items: ... }` 在本仪表中只显示为一条 query（Prisma 会把嵌套 include 合并或拆成多个 SQL，取决于关系类型）。实际 SQL 数可能更多；要精确区分，将来可改为直接挂 Prisma 的 `$on("query")` 事件（但那样拿不到 model / op 的 typed 信息）。
- 本仪表用 `next/headers` 读 request id。当路由在 proxy matcher 外（本 issue 的 5 条目标路由都在外）或 query 发生在非请求上下文（模块 init 时）时，header 读取会返回 null，仪表改用 fallback bucket：按 300ms 空闲窗口滚动 `unk_N` 编号。本次测量依赖这套分桶；只要相邻 curl 间隔 > 300ms，每次请求能独占一个 bucket。若并发请求或请求之间 < 300ms，多次请求会合并成同一 bucket，此时 N+1 判断仍然有效，但"每次请求的查询数"会失真。
- 测量在 single-process `next dev` 下进行；生产多 instance 场景下绝对耗时会受连接池和跨 AZ 延迟影响，但查询 **结构与次数** 不变，本报告结论仍成立。
