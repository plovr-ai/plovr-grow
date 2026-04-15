# 架构设计

## App 架构规范

### 多应用架构 (Route Groups)

项目采用 Next.js Route Groups 实现多应用隔离：

| 应用 | Route Group | URL 前缀 | 用途 | 认证体系 |
|------|-------------|----------|------|----------|
| Storefront (官网) | `(storefront)` | `/{companySlug}` | 品牌官网 + 门店列表 | 无 |
| Storefront (点餐) | `(storefront)` | `/r/{merchantSlug}` | 在线点餐 (菜单/购物车/结账) | 顾客 (可选) |
| Dashboard | `(dashboard)` | `/dashboard` | 商户端 - 商家后台 | 商户员工 |
| Admin | `(admin)` | `/admin` | 内部管理 - 平台管理 | 内部员工 |
| Website | `(website)` | `/` | 营销落地页 (about, pricing, blog 等) | 无 |

**Storefront 双层路由说明**：
- `/{companySlug}` - 品牌级页面，展示品牌官网和门店列表（URL 参数名保留为 `companySlug`）
- `/r/{merchantSlug}` - 门店级页面（Merchant），处理具体门店的点餐流程
- 一个租户（Tenant）可以有多个门店（Merchant）

**Route Groups 语法说明**：
- 括号内的目录名 (如 `(storefront)`) 不会出现在 URL 中
- 每个 Route Group 拥有独立的 `layout.tsx`，可实现不同的页面框架和认证逻辑
- 组件和页面按应用隔离，便于维护

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

API 按应用分组，便于权限控制：

```
api/
├── storefront/          # 用户端 API (公开或顾客认证)
│   └── r/[slug]/
├── dashboard/           # 商户端 API (商户认证)
│   └── [merchantId]/
├── admin/               # 管理端 API (内部认证)
├── auth/                # 认证 API (登录/注册/OTP)
├── cron/                # 定时任务 API
├── external/            # 外部服务回调
├── generator/           # 网站生成器 API
├── integration/         # 第三方集成 API (Square 等)
├── leads/               # 线索收集 API
└── webhooks/            # Webhook 接收端点
```

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
| 表 | 说明 |
|---|---|
| **核心** | |
| tenants | 租户 / 品牌 (含 slug) |
| merchants | 门店详情 (含 slug) |
| users | 商家员工 |
| **菜单** | |
| menus | 菜单 |
| menu_categories | 菜单分类 |
| menu_items | 菜品 |
| menu_category_items | 分类-菜品关联 (多对多) |
| modifier_groups | 修饰符组 (如：大小、配料) |
| modifier_options | 修饰符选项 |
| menu_item_modifier_groups | 菜品-修饰符组关联 |
| featured_items | 推荐菜品 |
| **税费** | |
| tax_configs | 税种配置 (Tenant 级别) |
| merchant_tax_rates | 门店税率 (Merchant 级别) |
| menu_item_taxes | 菜品税种关联 (多对多) |
| **订单** | |
| orders | 订单 |
| order_items | 订单明细 |
| order_item_modifiers | 订单项修饰符 |
| order_fulfillments | 履约记录 |
| fulfillment_status_logs | 履约状态日志 |
| order_sequences | 订单序号 |
| **支付** | |
| payments | 支付记录 |
| stripe_payment_details | Stripe 支付详情 |
| stripe_connect_accounts | Stripe Connect 账户 |
| **餐饮承包** | |
| catering_leads | 承包线索 |
| catering_orders | 承包订单 |
| catering_order_sequences | 承包订单序号 |
| **礼品卡** | |
| gift_cards | 礼品卡 |
| gift_card_transactions | 礼品卡交易 |
| gift_card_order_sequences | 礼品卡订单序号 |
| **发票** | |
| invoices | 发票 |
| invoice_sequences | 发票序号 |
| **Loyalty** | |
| loyalty_configs | Loyalty 配置 |
| loyalty_members | Loyalty 会员 |
| point_transactions | 积分交易 |
| **订阅** | |
| subscriptions | 订阅计划 |
| **认证** | |
| otp_verifications | OTP 验证码 |
| **集成** | |
| integration_connections | 第三方集成连接 |
| external_id_mappings | 外部 ID 映射 |
| integration_sync_records | 集成同步记录 |
| webhook_events | Webhook 事件 |
| **网站生成** | |
| website_generations | AI 生成的网站 |
| leads | 营销线索 |
