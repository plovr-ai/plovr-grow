# 架构设计

## App 架构规范

### 多应用架构 (Route Groups)

项目采用 Next.js Route Groups 实现多应用隔离：

| 应用 | Route Group | URL 前缀 | 用途 | 认证体系 |
|------|-------------|----------|------|----------|
| Website | `(website)` | `/` | 营销落地页 (about, pricing, blog 等) | 无 |
| Storefront (官网) | `(storefront)` | `/{companySlug}` | 品牌官网 + 门店列表 | 无 |
| Storefront (点餐) | `(storefront)` | `/r/{merchantSlug}` | 在线点餐 (菜单/购物车/结账) | 顾客 (可选) |
| Dashboard | `(dashboard)` | `/dashboard` | 商户端 - 商家后台 | 商户员工 |
| Admin | `(admin)` | `/admin` | 内部管理 - 平台管理 | 内部员工 |

**Storefront 双层路由**：`/{companySlug}` 品牌级 → `/r/{merchantSlug}` 门店级，一个 Tenant 可有多个 Merchant。

### 路径别名

| 别名 | 路径 | 用途 |
|------|------|------|
| `@/*` | `./src/*` | 通用模块 |
| `@storefront/*` | `./src/app/(storefront)/*` | Storefront 应用内部模块 |

```typescript
// Storefront 组件引用
import { MenuPageClient } from "@storefront/components/menu";

// 通用模块引用
import { useFormatPrice } from "@/hooks";
```

### 应用内目录结构规范

每个应用 (Route Group) 内部结构：

```
(app-name)/
├── components/          # 该应用专属组件
├── hooks/               # 该应用专属 Hooks (如需要)
├── [route]/             # 页面路由
│   ├── layout.tsx
│   └── page.tsx
└── layout.tsx           # 应用根 Layout (认证、导航等)
```

### API 路由规范

API 按应用/职能分组（`src/app/api/` 下），主要有：`storefront/`、`dashboard/`、`admin/`、`auth/`、`cron/`、`external/`、`generator/`、`integration/`、`leads/`、`webhooks/`。

## 架构分层

```
┌─────────────────────────────────────────┐
│  Presentation (app/, components/)       │
├─────────────────────────────────────────┤
│  Service Layer (services/)              │  ← 核心业务逻辑
├─────────────────────────────────────────┤
│  Repository Layer (repositories/)       │  ← 数据访问抽象
├─────────────────────────────────────────┤
│  Database (Prisma + MySQL)              │
└─────────────────────────────────────────┘
```

## 多租户设计

### 数据模型层次
```
Tenant (租户 / 品牌 / SaaS账户) - 有 slug 字段
  ↓ 1:N
Merchant (门店/位置) - 有 slug 字段
```

### 隔离策略
- 采用单数据库 + tenant_id 隔离模式
- 所有业务表包含 `tenant_id` 字段
- Tenant 和 Merchant 各有独立的 `slug` 字段（全局唯一）
- 品牌页面通过 `/{companySlug}` 识别（`companySlug` 实际对应 `tenant.slug`，URL 参数名保留以兼容旧链接）
- 门店页面通过 `/r/{merchantSlug}` 识别
- Repository 层自动注入 tenant 过滤条件

## 数据库表

完整表结构见 `prisma/schema.prisma`（当前 41 张表）。核心业务域：

| 域 | 关键表 |
|---|---|
| 核心 | `tenants`, `merchants`, `users` |
| 菜单 | `menus`, `menu_categories`, `menu_items`, `menu_category_items`, `modifier_groups`, `modifier_options` |
| 税费 | `tax_configs`, `merchant_tax_rates`, `menu_item_taxes` |
| 订单 | `orders`, `order_items`, `order_fulfillments`, `payments` |
| 餐饮承包 | `catering_leads`, `catering_orders`, `invoices` |
| 礼品卡 | `gift_cards`, `gift_card_transactions` |
| Loyalty | `loyalty_configs`, `loyalty_members`, `point_transactions` |
| 支付 | `stripe_connect_accounts`, `subscriptions` |
| 集成 | `integration_connections`, `external_id_mappings`, `webhook_events` |
