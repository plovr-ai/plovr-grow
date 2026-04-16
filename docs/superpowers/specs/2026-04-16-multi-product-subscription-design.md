# Multi-Product Line Subscription Design

**Issue**: #277 — subscription支持多产品线独立订阅
**Date**: 2026-04-16
**Type**: Feature enhancement

## Overview

将现有的 1:1 (Tenant → Subscription) 订阅模型扩展为 1:N，支持同一租户订阅多个独立产品线。每个产品线有自己的计划档位、计费周期、试用期，互不影响。

## 当前产品线

| ProductLine | 名称 | 档位 | 状态 |
|-------------|------|------|------|
| `platform` | 在线点餐平台 | starter / pro / enterprise | 已有 |
| `phone_ai` | 电话点餐 AI | 待定义 | 新增 |

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| 实现方式 | 现有 Subscription 表增加 `productLine` 字段 | 最小改动，复用已有基础设施 |
| 产品线间关系 | 完全独立 | 各自独立 Stripe Subscription、计费周期、试用期 |
| Tenant denormalization | 移除 | 去掉 `subscriptionPlan`/`subscriptionStatus`，统一查 Subscription 表 |
| Stripe Customer | 同一 Tenant 共享 | 不同产品线的订阅挂在同一个 Stripe Customer 下 |
| Dashboard UI | 单一概览页 | 所有产品线在概览页分区块展示，不设详情页 |
| Phone AI 档位 | 暂不定义 | 结构预留，后续填充具体档位和定价 |

## 1. 数据模型变更

### Subscription 表

新增 `productLine` 字段，联合唯一约束替代原 `tenantId` unique：

```prisma
model Subscription {
  id                    String   @id @default(cuid())
  tenantId              String   @map("tenant_id")
  productLine           String   @default("platform") @map("product_line")

  stripeCustomerId      String   @map("stripe_customer_id")  // 移除 unique，同一 customer 多个订阅
  stripeSubscriptionId  String?  @unique @map("stripe_subscription_id")
  stripePriceId         String?  @map("stripe_price_id")

  status                String   @default("incomplete")
  plan                  String   @default("free")
  currentPeriodStart    DateTime? @map("current_period_start")
  currentPeriodEnd      DateTime? @map("current_period_end")
  trialStart            DateTime? @map("trial_start")
  trialEnd              DateTime? @map("trial_end")
  cancelAtPeriodEnd     Boolean  @default(false) @map("cancel_at_period_end")
  canceledAt            DateTime? @map("canceled_at")
  gracePeriodEnd        DateTime? @map("grace_period_end")
  deleted               Boolean  @default(false)
  createdAt             DateTime @default(now()) @map("created_at")
  updatedAt             DateTime @updatedAt @map("updated_at")

  tenant                Tenant   @relation(fields: [tenantId], references: [id])

  @@unique([tenantId, productLine])
  @@map("subscriptions")
}
```

### Tenant 表

- 移除 `subscriptionPlan` 字段
- 移除 `subscriptionStatus` 字段
- 关系从 `subscription Subscription?` 改为 `subscriptions Subscription[]`

### Migration

1. 新增 `product_line` 列，默认值 `"platform"`
2. 移除 `tenant_id` 的 unique 约束
3. 新增 `(tenant_id, product_line)` 联合唯一约束
4. 移除 `stripe_customer_id` 的 unique 约束
5. 从 `tenants` 表移除 `subscription_plan` 和 `subscription_status` 列

现有数据自动获得 `product_line = "platform"`，无需手动数据迁移。

## 2. ProductLine 与 Plan 定义

### ProductLine 类型

```typescript
export const PRODUCT_LINES = ["platform", "phone_ai"] as const;
export type ProductLine = typeof PRODUCT_LINES[number];
```

### Plan 定义按 productLine 分组

```typescript
export const PLAN_DEFINITIONS: Record<ProductLine, Record<string, PlanDefinition>> = {
  platform: {
    starter: {
      name: "Starter",
      code: "starter",
      monthlyPrice: 49,
      tier: 1,
      features: ["Online ordering", "Menu management", "Order management", "1 location"],
      stripePriceEnvKey: "STRIPE_PLATFORM_STARTER_PRICE_ID",
    },
    pro: {
      name: "Pro",
      code: "pro",
      monthlyPrice: 99,
      tier: 2,
      features: ["Everything in Starter", "Loyalty program", "Gift cards", "Catering", "Up to 3 locations"],
      stripePriceEnvKey: "STRIPE_PLATFORM_PRO_PRICE_ID",
      recommended: true,
    },
    enterprise: {
      name: "Enterprise",
      code: "enterprise",
      monthlyPrice: 199,
      tier: 3,
      features: ["Everything in Pro", "Analytics & reporting", "Priority support", "Unlimited locations"],
      stripePriceEnvKey: "STRIPE_PLATFORM_ENTERPRISE_PRICE_ID",
    },
  },
  phone_ai: {
    // 档位待定义，结构与 platform 相同
  },
};
```

### Helper 函数

- `getPlanByCode(productLine, code)` — 查找计划定义
- `getPlanByStripePriceId(stripePriceId)` — 遍历所有 productLine 反查（webhook 场景），返回 `{ productLine, plan }`
- `getStripePriceId(productLine, planCode)` — 获取 Stripe Price ID
- `getAllPlans(productLine)` — 返回某产品线的所有计划
- `getPlanTier(productLine, planCode)` — 获取档位层级

## 3. Service 与 Repository 层

### Repository

查询主键从 `tenantId` 改为 `(tenantId, productLine)`：

- `getByTenantId(tenantId, productLine)` — 主查询
- `getAllByTenantId(tenantId)` — 新增，获取所有产品线订阅
- `getByStripeSubscriptionId(stripeSubscriptionId)` — 不变（webhook 用）
- `create(tenantId, productLine, data)` — 新增 productLine
- `updateByTenantId(tenantId, productLine, data)` — 联合更新
- `exists(tenantId, productLine)` — 检查某产品线是否有订阅

移除 `updateTenantSubscriptionStatus` 方法。

### Service

方法签名增加 `productLine` 参数：

```typescript
// 查询
getSubscription(tenantId, productLine): Promise<SubscriptionInfo>
getSubscriptionForDashboard(tenantId, productLine): Promise<DashboardSubscriptionInfo>
getAllSubscriptions(tenantId): Promise<SubscriptionInfo[]>
isSubscriptionActive(tenantId, productLine): Promise<boolean>
canAccessFeature(tenantId, productLine): Promise<boolean>

// 管理
createCheckoutSession(tenantId, productLine, planCode, options)
cancelSubscription(tenantId, productLine, cancelImmediately)
resumeSubscription(tenantId, productLine)
changePlan(tenantId, productLine, newPlanCode)
createBillingPortalSession(tenantId, returnUrl)  // 不变，customer 级别
```

### Stripe Customer 共享

同一 Tenant 共享 `stripeCustomerId`：
- `getOrCreateStripeCustomer` 改为：先查该 Tenant 下任意一条 Subscription 的 `stripeCustomerId`，有则复用，无则创建

### Webhook 处理

逻辑基本不变：
1. Stripe event 包含 `subscription.id`
2. 通过 `getByStripeSubscriptionId` 查到记录，天然包含 `productLine`
3. `handleSubscriptionUpdated` 中 plan 反查用 `getPlanByStripePriceId`（遍历所有 productLine）
4. 移除所有 `updateTenantSubscriptionStatus` 调用

## 4. API 路由

| Method | Route | 说明 |
|--------|-------|------|
| GET | `/api/dashboard/subscription` | 返回所有产品线的订阅状态 + 可选计划列表 |
| POST | `/api/dashboard/subscription/[productLine]/checkout` | 创建某产品线的 checkout |
| POST | `/api/dashboard/subscription/[productLine]/change-plan` | 升降级 |
| POST | `/api/dashboard/subscription/[productLine]/cancel` | 取消 |
| POST | `/api/dashboard/subscription/[productLine]/resume` | 恢复 |
| POST | `/api/dashboard/subscription/portal` | Billing Portal |

GET 返回结构：

```typescript
{
  productLines: [
    {
      productLine: "platform",
      name: "在线点餐平台",
      subscription: { status, plan, currentPeriodEnd, ... } | null,
      availablePlans: [{ code, name, monthlyPrice, features, ... }, ...]
    },
    {
      productLine: "phone_ai",
      name: "电话点餐 AI",
      subscription: null,
      availablePlans: []  // 档位未定义时为空
    }
  ]
}
```

路由层校验 `productLine` 必须在 `PRODUCT_LINES` 中，否则 400。

## 5. Dashboard UI

### 单一概览页 (`/dashboard/subscription`)

按产品线分区块展示：
- 每个区块包含：产品线名称、当前订阅状态（或"未订阅"）、定价卡片列表
- 订阅/升降级/取消/恢复操作直接在概览页完成
- 试用期、欠费、取消 banner 附在对应产品线区块内
- 无可选计划的产品线显示"即将推出"

### 组件

- `SubscriptionClient` — 重构为接收多产品线数据，循环渲染各产品线区块
- `ProductLineSection` — 新增，单个产品线区块（名称 + 状态 + banner + 定价卡片）
- `PricingCard` — 不变
- `SubscriptionStatusBadge` — 不变

## 6. 受影响代码排查

需要搜索并替换所有引用 `tenant.subscriptionPlan` 和 `tenant.subscriptionStatus` 的代码，改为调用 SubscriptionService：
- Dashboard layout/middleware 中的权限检查
- 需要判断订阅状态的 API 路由
- 任何直接读取 Tenant 表订阅字段的代码

## 7. 环境变量

```env
# Platform plans（重命名，加 PLATFORM 前缀）
STRIPE_PLATFORM_STARTER_PRICE_ID=price_xxx
STRIPE_PLATFORM_PRO_PRICE_ID=price_xxx
STRIPE_PLATFORM_ENTERPRISE_PRICE_ID=price_xxx

# Phone AI plans（后续添加）
# STRIPE_PHONE_AI_BASIC_PRICE_ID=price_xxx
# STRIPE_PHONE_AI_PRO_PRICE_ID=price_xxx

# 不变
STRIPE_TRIAL_DAYS=14
STRIPE_GRACE_PERIOD_DAYS=7
```

## 8. 测试

- Plan helper 函数：按 productLine 查询、反查
- Service 层：多产品线独立订阅 CRUD、Stripe Customer 共享
- Webhook：通过 stripeSubscriptionId 正确关联产品线
- API 路由：productLine 参数校验、概览接口返回结构
- 移除 denormalization 后的权限检查回归

## Files Changed Summary

| File | Action |
|------|--------|
| `prisma/schema.prisma` | Modified — Subscription 加 productLine，Tenant 移除 denorm 字段 |
| `src/services/subscription/subscription.types.ts` | Modified — 新增 ProductLine 类型，更新接口 |
| `src/services/subscription/subscription.plans.ts` | Modified — Plan 按 productLine 分组 |
| `src/services/subscription/subscription.service.ts` | Modified — 所有方法加 productLine 参数 |
| `src/repositories/subscription.repository.ts` | Modified — 查询改为联合键 |
| `src/app/api/dashboard/subscription/route.ts` | Modified — 返回多产品线概览 |
| `src/app/api/dashboard/subscription/[productLine]/checkout/route.ts` | New |
| `src/app/api/dashboard/subscription/[productLine]/change-plan/route.ts` | New |
| `src/app/api/dashboard/subscription/[productLine]/cancel/route.ts` | New |
| `src/app/api/dashboard/subscription/[productLine]/resume/route.ts` | New |
| `src/app/api/dashboard/subscription/portal/route.ts` | 不变 |
| `src/components/dashboard/subscription/SubscriptionClient.tsx` | Modified — 多产品线渲染 |
| `src/components/dashboard/subscription/ProductLineSection.tsx` | New |
| 引用 tenant.subscriptionPlan/Status 的文件 | Modified — 改为调 Service |
