# Plovr - 餐厅 SaaS 平台

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
│   │   │   ├── locations/         # 门店列表组件
│   │   │   └── icons/             # 图标组件
│   │   ├── [companySlug]/         # 品牌级路由 (官网)
│   │   │   ├── page.tsx           # 品牌官网首页
│   │   │   └── locations/         # 门店列表
│   │   └── r/[merchantSlug]/      # 门店级路由 (点餐)
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

## 税费系统设计

### 数据模型

税费系统采用三层结构，支持：
- **Company 级别定义税种**（如 "Standard Tax", "Alcohol Tax"）
- **Merchant 级别设置具体税率**（同一税种在不同门店可有不同税率）
- **MenuItem 关联多个税种**（如酒类商品同时有标准税和酒税）

```
Company (1:N) → TaxConfig (税种定义)
                    ↓
Merchant (N:M) → MerchantTaxRate (门店具体税率)
                    ↓
MenuItem (N:M) → MenuItemTax (菜品关联的税种)
```

### 核心表结构

```prisma
// 税种配置 (Company 级别)
model TaxConfig {
  id              String   @id
  tenantId        String
  companyId       String
  name            String   // "Standard Tax", "Alcohol Tax"
  description     String?
  roundingMethod  String   @default("half_up")  // half_up, half_even, always_round_up, always_round_down
  status          String   @default("active")
}

// 门店税率 (每个门店对每个税种的具体税率)
model MerchantTaxRate {
  id            String   @id
  merchantId    String
  taxConfigId   String
  rate          Decimal  @db.Decimal(5, 4)  // 0.0825 = 8.25%

  @@unique([merchantId, taxConfigId])
}

// 菜品税种关联 (多对多)
model MenuItemTax {
  id            String   @id
  menuItemId    String
  taxConfigId   String

  @@unique([menuItemId, taxConfigId])
}
```

### 税率舍入方法

| 方法 | 说明 | 示例 (0.125) |
|------|------|-------------|
| `half_up` | 四舍五入 (默认) | 0.13 |
| `half_even` | 银行家舍入 | 0.12 |
| `always_round_up` | 向上取整 | 0.13 |
| `always_round_down` | 向下取整 | 0.12 |

### 数据流

```
┌─────────────────────────────────────────────────────────────────────┐
│  菜单页面 (Menu Page)                                                │
│  └─ MenuService.getMenu(tenantId, merchantId)                       │
│      ├─ 获取 Company 级别菜单                                        │
│      ├─ 获取菜品关联的税种 IDs (MenuItemTax)                         │
│      ├─ 获取税种定义 (TaxConfig)                                     │
│      ├─ 获取门店税率 (MerchantTaxRate)                               │
│      └─ 返回菜品 + taxes[] 数组                                      │
├─────────────────────────────────────────────────────────────────────┤
│  购物车 (Cart Store)                                                 │
│  └─ 存储 CartItem.taxes: ItemTaxInfo[]                              │
├─────────────────────────────────────────────────────────────────────┤
│  价格计算 (usePricing Hook)                                          │
│  └─ 使用 item.taxes[] 计算每个商品的税额                             │
│      └─ 支持同一商品多个税种叠加计算                                  │
└─────────────────────────────────────────────────────────────────────┘
```

### 类型定义

```typescript
// 税种信息 (用于菜品和购物车)
interface ItemTaxInfo {
  taxConfigId: string;
  name: string;           // "Standard Tax"
  rate: number;           // 0.0825 (门店具体税率)
  roundingMethod: RoundingMethod;
}

// 菜品 ViewModel (包含税种信息)
interface MenuItemViewModel {
  id: string;
  name: string;
  price: number;
  taxes: ItemTaxInfo[];   // 支持多税种
  // ...
}

// 购物车商品 (包含税种信息)
interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  taxes?: ItemTaxInfo[];  // 用于价格计算
  // ...
}
```

### 使用示例

```typescript
// 1. 菜单服务返回带税种信息的菜品
const menu = await menuService.getMenu(tenantId, merchantId);
// menu.categories[0].menuItems[0].taxes = [
//   { taxConfigId: "tax-1", name: "Standard Tax", rate: 0.0825, roundingMethod: "half_up" }
// ]

// 2. 添加到购物车时传递 taxes
addItem({
  menuItemId: item.id,
  name: item.name,
  price: item.price,
  quantity: 1,
  taxes: item.taxes,  // 传递税种信息
});

// 3. 价格计算自动使用 taxes 数组
const { subtotal, taxAmount, totalAmount } = usePricing(cartItems, tip, fees);
// 支持：
// - 同一商品多个税种 (如酒类有标准税+酒税)
// - 不同商品不同税率
// - 免税商品 (taxes: [])
```

### 相关文件

| 文件 | 说明 |
|------|------|
| `src/repositories/tax-config.repository.ts` | 税种数据访问 |
| `src/services/menu/tax-config.service.ts` | 税种业务逻辑 |
| `src/services/menu/tax-config.types.ts` | 税种类型定义 |
| `src/services/menu/menu.service.ts` | 菜单服务 (集成税种) |
| `src/lib/pricing.ts` | 价格计算库 |
| `src/lib/tax.ts` | 税费舍入方法 |
| `src/hooks/usePricing.ts` | 价格计算 Hook |
| `src/stores/cart.store.ts` | 购物车状态管理 |

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

### Storefront 架构
```
/r/[merchantSlug]/layout.tsx (Server)
  └── 获取门店数据 (currency, locale)
      └── <MerchantProvider config={{ currency, locale }}>
          └── 子组件通过 useFormatPrice() 获取格式化函数
```

### Dashboard 使用方法

Dashboard 页面同样需要使用国际化，通过 `DashboardContext` 提供 `currency` 和 `locale`：

```typescript
// 在 Dashboard 组件中使用
import { useDashboardFormatPrice, useDashboardCurrencySymbol } from "@/hooks";

function DashboardComponent() {
  const formatPrice = useDashboardFormatPrice();
  const currencySymbol = useDashboardCurrencySymbol();

  return (
    <div>
      <span>{formatPrice(18.99)}</span>  {/* 格式化价格显示 */}
      <span>{currencySymbol}</span>       {/* 获取货币符号用于输入框前缀 */}
    </div>
  );
}
```

### Dashboard 架构
```
/dashboard/(protected)/layout.tsx (Server)
  └── 获取第一个 Merchant 的 currency/locale 作为默认值
      └── <DashboardProvider value={{ currency, locale, ... }}>
          └── 子组件通过 useDashboardFormatPrice() 获取格式化函数
```

**注意事项**：
- Dashboard 中**禁止硬编码货币符号**（如 `$`、`€`）
- 价格显示使用 `useDashboardFormatPrice()`
- 价格输入框前缀使用 `useDashboardCurrencySymbol()`

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
| Storefront | `http://localhost:3000/{companySlug}` | 品牌官网首页 |
| Storefront | `http://localhost:3000/{companySlug}/locations` | 门店列表 |
| Storefront | `http://localhost:3000/r/{merchantSlug}/menu` | 在线点餐 |
| Storefront | `http://localhost:3000/r/{merchantSlug}/cart` | 购物车 |
| Storefront | `http://localhost:3000/r/{merchantSlug}/checkout` | 结账 |
| Dashboard | `http://localhost:3000/dashboard` | 商户后台首页 |
| Dashboard | `http://localhost:3000/dashboard/{merchantId}` | 商户管理 |
| Admin | `http://localhost:3000/admin` | 内部管理 |

### 用户流程示例
```
访问 /joes-pizza (品牌官网)
  ↓
点击 "Order Online"
  ↓
单门店 → 直接跳转 /r/joes-pizza-downtown/menu
多门店 → 跳转 /joes-pizza/locations 选择门店
  ↓
浏览菜单 → 添加到购物车 → 结账
```

### URL 路由规范

Storefront 应用采用双层路由结构，**必须严格区分品牌级别和门店级别的路由**：

| 级别 | URL 模式 | Slug 类型 | 页面 |
|------|----------|-----------|------|
| 品牌级 | `/{companySlug}` | `companySlug` | 官网首页 |
| 品牌级 | `/{companySlug}/locations` | `companySlug` | 门店列表 |
| 门店级 | `/r/{merchantSlug}/menu` | `merchantSlug` | 菜单页 |
| 门店级 | `/r/{merchantSlug}/cart` | `merchantSlug` | 购物车 |
| 门店级 | `/r/{merchantSlug}/checkout` | `merchantSlug` | 结账页 |

**组件中构建链接的规范**：

```typescript
// ✅ 正确 - 品牌级页面使用 companySlug
const homeLink = `/${companySlug}`;
const locationsLink = `/${companySlug}/locations`;

// ✅ 正确 - 门店级页面使用 merchantSlug
const menuLink = `/r/${merchantSlug}/menu`;
const cartLink = `/r/${merchantSlug}/cart`;
const checkoutLink = `/r/${merchantSlug}/checkout`;

// ❌ 错误 - 混淆 slug 类型
const locationsLink = `/r/${merchantSlug}/locations`;  // locations 是品牌级页面！
const menuLink = `/${companySlug}/menu`;               // menu 是门店级页面！
```

**跨级别导航**：
- 从门店页面返回品牌官网：需要获取 `companySlug`（通过 merchant.company.slug）
- 从品牌官网进入门店页面：需要获取 `merchantSlug`（通过 company.merchants[].slug）

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

### 数据模型规范
- **所有业务表必须保留 `tenantId` 字段**（租户隔离）
- 菜单相关表（`MenuCategory`, `MenuItem`）使用 `companyId` 关联品牌，所有门店共享同一份菜单
- 菜单数据不再使用 `merchantId` 关联（后续如需门店级覆盖，通过单独的覆盖表实现）
- 数据模型层次：
  ```
  Tenant (1:1) → Company (1:N) → Merchant
                    ↓
              MenuCategory (1:N) → MenuItem
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

### 组件规范
- **禁止使用 Next.js `<Image>` 组件**: 使用原生 `<img>` 标签代替
  ```typescript
  // ❌ 不要这样
  import Image from "next/image";
  <Image src={logo} alt="logo" width={32} height={32} />

  // ✅ 使用原生 img 标签
  <img src={logo} alt="logo" className="h-8 w-8" />
  ```

### 主题色使用规范

项目使用 CSS 变量实现主题系统，每个主题色包含 4 个变体：

| 变体 | CSS 类 | 用途 |
|------|--------|------|
| base | `bg-theme-primary`, `text-theme-primary`, `border-theme-primary` | 主品牌色 |
| hover | `bg-theme-primary-hover`, `text-theme-primary-hover` | 较深变体，用于悬停或强调 |
| light | `bg-theme-primary-light` | 浅色背景（选中状态） |
| foreground | `text-theme-primary-foreground` | 深色背景上的文字（通常为白色） |

**使用场景**：

| 场景 | 背景 | 文字/图标 | 边框 |
|------|------|-----------|------|
| CTA 按钮 | `bg-theme-primary` | `text-theme-primary-foreground` | - |
| 按钮悬停 | `hover:bg-theme-primary-hover` | `text-theme-primary-foreground` | - |
| 选中项 | `bg-theme-primary-light` | `text-theme-primary-hover` | `border-theme-primary` |
| 活跃标签 | `bg-theme-primary` | `text-theme-primary-foreground` | - |
| 禁用状态 | `bg-gray-200` | `text-gray-400` | - |

**对比度规则**：
- 在 `bg-theme-primary` 上使用 `text-theme-primary-foreground`（白色）
- 在 `bg-theme-primary-light` 上使用 `text-theme-primary-hover`（深色）
- 避免在浅色背景上使用 `text-theme-primary`（对比度可能不足）

### Dashboard 表单组件

Dashboard 使用统一的表单组件库 (`@/components/dashboard/Form`)，提供一致的水平布局样式。

#### 组件列表

| 组件 | 用途 |
|------|------|
| `FormField` | 基础容器组件 (布局 + 标签 + 错误显示) |
| `TextField` | 文本输入 (text, email, password, number) |
| `TextareaField` | 多行文本输入 |
| `PriceField` | 价格输入 (自动添加货币符号前缀) |
| `SelectField` | 下拉选择框 |
| `RadioGroupField` | 单选按钮组 |
| `CheckboxField` | 单个复选框 |

#### 布局规范

默认使用**水平布局**：
- 标签宽度: 120px
- 标签对齐: 右对齐 (`text-right`)
- 多行内容 (如 Textarea): 使用 `alignTop` 使标签顶部对齐

```
┌─────────────────────────────────────────────────┐
│  [  Label  ]  [ Input Field                   ] │
│  (120px)      (flex: 1)                         │
└─────────────────────────────────────────────────┘
```

#### API 参考

```typescript
// 基础属性 (所有组件共享)
interface BaseFieldProps {
  id: string;                    // 字段 ID
  label: string;                 // 标签文字 (空字符串则不显示标签)
  required?: boolean;            // 显示红色 * 标记
  error?: string;                // 错误信息 (显示在输入框下方)
  layout?: "horizontal" | "vertical";  // 默认 "horizontal"
  labelWidth?: number;           // 标签宽度 (默认 120)
  className?: string;            // 容器 className
}

// TextField 额外属性
interface TextFieldProps extends BaseFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "email" | "password" | "number";
  disabled?: boolean;
  helperText?: string;           // 辅助文字 (显示在输入框下方)
}

// PriceField 额外属性
interface PriceFieldProps extends BaseFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;          // 默认 "0.00"
  disabled?: boolean;
  maxWidth?: string;             // 默认 "max-w-[200px]"
}
// 注: PriceField 内部使用 useDashboardCurrencySymbol() 自动获取货币符号

// SelectField 额外属性
interface SelectFieldProps extends BaseFieldProps {
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];  // 支持 readonly 数组
  disabled?: boolean;
  helperText?: string;
}
```

#### 使用示例

```typescript
import {
  TextField,
  TextareaField,
  PriceField,
  SelectField,
  RadioGroupField,
  CheckboxField,
  FormField,
} from "@/components/dashboard/Form";

// 文本输入
<TextField
  id="name"
  label="Name"
  required
  value={name}
  onChange={setName}
  placeholder="e.g., Classic Burger"
  error={errors.name}
/>

// 价格输入 (自动显示货币符号)
<PriceField
  id="price"
  label="Price"
  required
  value={price}
  onChange={setPrice}
/>

// 下拉选择
<SelectField
  id="category"
  label="Category"
  value={categoryId}
  onChange={setCategoryId}
  options={categories}
  helperText="Select a category for this item"
/>

// 单选按钮组
<RadioGroupField
  id="status"
  name="status"
  label="Status"
  value={status}
  onChange={setStatus}
  options={[
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
  ]}
/>

// 自定义内容 (使用 FormField)
<FormField id="image" label="Image" alignTop>
  <ImageUploader ... />
</FormField>
```

#### 何时使用原生 Input

以下场景应直接使用原生 `<Input>` 组件而非 Form 组件：

1. **内联输入**: 输入框与其他元素在同一行 (如复选框 + 标签 + 数字输入)
2. **动态列表**: 列表项内的输入 (如 Modifier 选项的名称/价格)
3. **复杂布局**: 无法用标准水平/垂直布局表达的情况

```typescript
// ✅ 使用 Form 组件: 标准表单字段
<TextField id="name" label="Name" value={name} onChange={setName} />

// ✅ 使用原生 Input: 动态列表内的内联输入
{modifiers.map((mod) => (
  <div className="flex items-center gap-2">
    <Input value={mod.name} onChange={...} />
    <Input type="number" value={mod.price} onChange={...} />
  </div>
))}
```

#### 相关文件

| 文件 | 说明 |
|------|------|
| `src/components/dashboard/Form.tsx` | 表单组件实现 |
| `src/components/dashboard/__tests__/Form.test.tsx` | 单元测试 (48 个用例) |

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
