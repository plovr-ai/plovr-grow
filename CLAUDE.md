# Reborn - 餐厅 SaaS 平台

## 项目概述
为美国市场餐厅提供的线上解决方案，包括官网、在线点餐、Loyalty 等功能。

## 技术栈
- **框架**: Next.js 16 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **数据库**: MySQL + Prisma ORM
- **状态管理**: Zustand (购物车)
- **验证**: Zod

## 项目结构

```
src/
├── app/                           # Next.js App Router
│   ├── (storefront)/              # 用户端应用 (Route Group)
│   │   ├── components/            # Storefront 组件
│   │   │   ├── website/           # 官网模板组件
│   │   │   ├── menu/              # 菜单组件
│   │   │   ├── checkout/          # 结账组件
│   │   │   └── icons/             # 图标组件
│   │   └── r/[slug]/              # 餐厅页面路由
│   │       ├── menu/
│   │       ├── cart/
│   │       └── checkout/
│   │
│   ├── (dashboard)/               # 商户端应用 (Route Group)
│   │   └── dashboard/
│   │       └── [merchantId]/      # 商户管理页面
│   │           ├── menu/
│   │           ├── orders/
│   │           └── settings/
│   │
│   ├── (admin)/                   # 内部管理应用 (Route Group)
│   │   └── admin/
│   │       ├── tenants/
│   │       └── merchants/
│   │
│   └── api/                       # API Routes
│       ├── storefront/            # 用户端 API
│       ├── dashboard/             # 商户端 API
│       └── admin/                 # 管理端 API
│
├── contexts/                      # React Context
├── hooks/                         # 自定义 Hooks
├── services/                      # 领域服务层
├── repositories/                  # 数据访问层
├── lib/                           # 工具库
├── stores/                        # Zustand 状态管理
├── data/mock/                     # Mock 数据
└── types/                         # TypeScript 类型定义
```

## App 架构规范

### 多应用架构 (Route Groups)

项目采用 Next.js Route Groups 实现多应用隔离：

| 应用 | Route Group | URL 前缀 | 用途 | 认证体系 |
|------|-------------|----------|------|----------|
| Storefront | `(storefront)` | `/r/{slug}` | 用户端 - 官网 + 在线点餐 | 顾客 (可选) |
| Dashboard | `(dashboard)` | `/dashboard` | 商户端 - 商家后台 | 商户员工 |
| Admin | `(admin)` | `/admin` | 内部管理 - 平台管理 | 内部员工 |

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
- 采用单数据库 + tenant_id 隔离模式
- 所有业务表包含 `tenant_id` 字段
- 通过 URL 路径 `/r/{slug}` 识别租户
- Repository 层自动注入 tenant 过滤条件

## 数据库表
| 表 | 说明 |
|---|---|
| tenants | 租户 (SaaS 账户) |
| merchants | 商家详情 |
| users | 商家员工 |
| menu_categories | 菜单分类 |
| menu_items | 菜品 |
| orders | 订单 |
| customers | 顾客 (Loyalty) |

## 国际化支持

### 货币和地区格式
每个门店可配置独立的货币和地区格式：

```typescript
// 门店配置 (MerchantInfo)
{
  currency: "USD",    // 货币代码 (ISO 4217)
  locale: "en-US",    // 地区代码 (BCP 47)
}
```

### 支持的格式示例
| currency | locale | 显示效果 |
|----------|--------|---------|
| USD | en-US | $100.00 |
| EUR | de-DE | 100,00 € |
| EUR | en-US | €100.00 |
| CNY | zh-CN | ¥100.00 |
| JPY | ja-JP | ￥100 |

### 使用方法
```typescript
// 在组件中使用 useFormatPrice hook
import { useFormatPrice } from "@/hooks";

function MyComponent() {
  const formatPrice = useFormatPrice();
  return <span>{formatPrice(18.99)}</span>;  // 自动使用门店配置的货币格式
}
```

### 架构
```
/r/[slug]/layout.tsx (Server)
  └── 获取门店数据 (currency, locale)
      └── <MerchantProvider config={{ currency, locale }}>
          └── 子组件通过 useFormatPrice() 获取格式化函数
```

## 常用命令

```bash
# 开发
npm run dev              # 启动开发服务器

# 测试
npm run test             # 运行测试 (watch 模式)
npm run test:run         # 运行测试 (单次)

# 数据库
npm run db:generate      # 生成 Prisma 客户端
npm run db:push          # 同步 schema 到数据库
npm run db:migrate       # 运行迁移
npm run db:seed          # 填充测试数据
npm run db:studio        # 打开 Prisma Studio

# 构建
npm run build            # 生产构建
npm run lint             # 代码检查
```

## 访问路径

| 应用 | URL | 说明 |
|------|-----|------|
| Storefront | `http://localhost:3000/r/{slug}` | 餐厅官网 |
| Storefront | `http://localhost:3000/r/{slug}/menu` | 在线点餐 |
| Dashboard | `http://localhost:3000/dashboard` | 商户后台首页 |
| Dashboard | `http://localhost:3000/dashboard/{merchantId}` | 商户管理 |
| Admin | `http://localhost:3000/admin` | 内部管理 |

## 开发约定

### 命名规范
- 组件: PascalCase (`Navigation.tsx`)
- 工具函数: camelCase (`formatPrice`)
- 类型: PascalCase (`MerchantInfo`)
- 数据库字段: snake_case (`tenant_id`)

### 文件组织
- 每个 service 包含: `index.ts`, `*.service.ts`, `*.types.ts`
- 组件按功能域分组 (`website/`, `menu/`, `cart/`)
- Mock 数据放在 `data/mock/`

### 代码风格
- 优先使用函数组件 + Hooks
- 服务层使用 class 便于后续拆分微服务
- Repository 封装所有数据库操作，自动处理 tenant 隔离

### Service 层参数规范
- **所有 Service 方法的第一个参数必须是 `tenantId`**（租户隔离）
- 需要门店上下文的方法，第二个参数为 `merchantId`
- 示例：
  ```typescript
  // ✅ 正确
  async getMenu(tenantId: string, merchantId: string): Promise<GetMenuResponse>
  async createCategory(tenantId: string, input: CreateCategoryInput)

  // ❌ 错误 - 缺少 tenantId
  async getMenu(merchantId: string): Promise<GetMenuResponse>
  ```

### TypeScript 规范
- **禁止使用 `any`**: 使用 `unknown` 或具体类型代替，必要时使用类型断言
- **禁止使用 `enum`**: 使用 `const` 对象 + `as const` 或联合类型代替
  ```typescript
  // ❌ 不要这样
  enum Status { Active, Inactive }

  // ✅ 使用联合类型
  type Status = 'active' | 'inactive';

  // ✅ 或使用 const 对象
  const Status = { Active: 'active', Inactive: 'inactive' } as const;
  type Status = typeof Status[keyof typeof Status];
  ```

## Claude Code Skills

项目自定义的 Claude Code skills，位于 `.claude/commands/` 目录：

| Skill | 命令 | 说明 |
|-------|------|------|
| review-i18n | `/review-i18n` | 检查代码中是否有硬编码的货币符号和 locale |

### /review-i18n

检查代码中是否存在：
- 硬编码的货币符号 (`$`, `€`, `¥`, `£` 等)
- 硬编码的 locale 字符串 (`en-US`, `zh-CN` 等)

应该使用：
- `useFormatPrice()` - 格式化价格
- `useCurrencySymbol()` - 获取货币符号
- `useMerchantConfig()` - 获取 locale 配置
