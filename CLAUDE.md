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
- **国际化**: next-intl

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

## 详细文档索引

涉及以下领域时，请先阅读对应文档：

| 文档 | 何时阅读 |
|------|----------|
| [架构设计](.claude/docs/architecture.md) | 涉及 App 架构、多租户、分层设计、数据库表 |
| [税费系统](.claude/docs/tax-system.md) | 涉及税种配置、税率计算、舍入方法 |
| [国际化与多语言](.claude/docs/i18n.md) | 涉及货币格式、翻译、错误码、AppError |
| [URL 路由规范](.claude/docs/routing.md) | 涉及 URL 构建、slug 使用、页面导航 |
| [Dashboard 表单组件](.claude/docs/dashboard-forms.md) | 涉及 Dashboard 表单 UI 开发 |

---

## 开发约定

以下规则**必须始终遵守**，无需查阅子文档。

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

### 数据库迁移规范
- **禁止手写 Prisma migration SQL 文件** — 只修改 `prisma/schema.prisma`，migration 文件必须通过 `npx prisma migrate dev --name <name>` 生成
- 若本地 DB 不可达或无法跑 `migrate dev`，停下来让用户执行，不要手写或伪造 migration SQL
- 提交 schema 改动时不提交手写的 migration 目录

### TypeScript 规范 (ESLint 自动拦截)
- **禁止使用 `any`**: 使用 `unknown` 或具体类型代替 (`@typescript-eslint/no-explicit-any`)
- **禁止使用 `enum`**: 使用 `const` 对象 + `as const` 或联合类型代替 (`no-restricted-syntax`)

### i18n 规范
- **禁止在 Service 层硬编码错误消息** — 使用 `AppError` + 错误码
- **禁止在组件中硬编码 UI 文案** — 使用 `useTranslations()`
- **禁止硬编码货币符号** — 使用 `useFormatPrice()` / `useDashboardFormatPrice()`
- 新增错误码时同步更新 `error-codes.ts` 和 `shared/en.json`

### 主题色使用规范

项目使用 CSS 变量实现主题系统，每个主题色包含 4 个变体：

| 变体 | CSS 类 | 用途 |
|------|--------|------|
| base | `bg-theme-primary`, `text-theme-primary`, `border-theme-primary` | 主品牌色 |
| hover | `bg-theme-primary-hover`, `text-theme-primary-hover` | 较深变体，用于悬停或强调 |
| light | `bg-theme-primary-light` | 浅色背景（选中状态） |
| foreground | `text-theme-primary-foreground` | 深色背景上的文字（通常为白色） |

**对比度规则**：
- 在 `bg-theme-primary` 上使用 `text-theme-primary-foreground`（白色）
- 在 `bg-theme-primary-light` 上使用 `text-theme-primary-hover`（深色）
- 避免在浅色背景上使用 `text-theme-primary`（对比度可能不足）

### URL 路由规范（速查）

**必须严格区分品牌级 (`/{companySlug}`) 和门店级 (`/r/{merchantSlug}`) 路由**：

```typescript
// 品牌级
const homeLink = `/${companySlug}`;
const locationsLink = `/${companySlug}/locations`;

// 门店级
const menuLink = `/r/${merchantSlug}/menu`;
const cartLink = `/r/${merchantSlug}/cart`;
const checkoutLink = `/r/${merchantSlug}/checkout`;
```

详细规范见 [routing.md](.claude/docs/routing.md)。

## Claude Code Skills

| Skill | 命令 | 说明 |
|-------|------|------|
| review-i18n | `/review-i18n` | 检查代码中是否有硬编码的货币符号和 locale |
