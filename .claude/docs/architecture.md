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

**Storefront 双层路由说明**：
- `/{companySlug}` - 品牌级页面（Company），展示品牌官网和门店列表
- `/r/{merchantSlug}` - 门店级页面（Merchant），处理具体门店的点餐流程
- 一个品牌（Company）可以有多个门店（Merchant）

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
└── admin/               # 管理端 API (内部认证)
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
Tenant (租户/SaaS账户)
  ↓ 1:1
Company (品牌/连锁店) - 有 slug 字段
  ↓ 1:N
Merchant (门店/位置) - 有 slug 字段
```

### 隔离策略
- 采用单数据库 + tenant_id 隔离模式
- 所有业务表包含 `tenant_id` 字段
- Company 和 Merchant 各有独立的 `slug` 字段（全局唯一）
- 品牌页面通过 `/{companySlug}` 识别
- 门店页面通过 `/r/{merchantSlug}` 识别
- Repository 层自动注入 tenant 过滤条件

## 数据库表
| 表 | 说明 |
|---|---|
| tenants | 租户 (SaaS 账户) |
| companies | 品牌/连锁店 (含 slug) |
| merchants | 门店详情 (含 slug) |
| users | 商家员工 |
| menu_categories | 菜单分类 |
| menu_items | 菜品 |
| tax_configs | 税种配置 (Company 级别) |
| merchant_tax_rates | 门店税率 (Merchant 级别) |
| menu_item_taxes | 菜品税种关联 (多对多) |
| orders | 订单 |
| customers | 顾客 (Loyalty) |
