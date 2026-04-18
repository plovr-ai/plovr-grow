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
- 服务层以对象字面量导出（详见下方「Service 层导出规范」）
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

### Service 层导出规范

- **禁止** `export class XxxService` 写法
- Service 必须导出对象字面量：`export const xxxService = { ... }`
- 方法实现采用"模块级函数 + 对象字面量聚合"模式：

  ```typescript
  // 1. 方法先声明为模块级 async function
  async function getMerchantBySlug(slug: string) { ... }
  async function getMerchantById(tenantId: string, id: string) { ... }

  // 2. 方法内互调用直接引用函数名，不使用 this/xxxService.xxx
  async function getCompanyMerchantBySlug(slug: string) {
    return getMerchantBySlug(slug);
  }

  // 3. 对外导出为对象字面量聚合所有方法
  export const merchantService = {
    getMerchantBySlug,
    getMerchantById,
    getCompanyMerchantBySlug,
  };
  ```

- `private`/`protected` 成员 → 模块级 `const`/`function` 不 export 即等效 private
- **DI 例外**：确有构造参数依赖的，用工厂函数 `createXxxService(deps)` 返回对象字面量，不用 class

**历史例外（待后续迁移）**：

- `src/services/generator/generator.service.ts` — 依赖 `GooglePlacesClient`
- `src/services/sms/sms.service.ts` — 依赖 `SmsProvider`
- `src/services/generator/google-places.client.ts` — 依赖 API key

这 3 个暂时保留为 class，后续通过独立 PR 迁移为工厂函数形式。

### 数据模型规范
- **所有业务表必须保留 `tenantId` 字段**（租户隔离）
- 菜单相关表（`MenuCategory`, `MenuItem`）通过 `tenantId` 关联品牌，同一租户下所有门店共享同一份菜单
- 菜单数据不再使用 `merchantId` 关联（后续如需门店级覆盖，通过单独的覆盖表实现）
- 数据模型层次：
  ```
  Tenant (1:N) → Merchant
      ↓
  MenuCategory (1:N) → MenuItem
  ```

### 数据库变更流程
- **禁止手写 migration SQL 文件** — 必须由 Prisma 自动生成，手写极易出现 MySQL 语法错误
- 正确流程：
  1. 修改 `prisma/schema.prisma`
  2. 运行 `npm run db:migrate` 让 Prisma 生成 migration SQL
  3. 如需额外操作（如数据迁移、重命名），在 Prisma 生成的 SQL 基础上追加，而非从零手写
- **禁止直接创建 `prisma/migrations/` 下的目录或文件** — 这些全部由 `prisma migrate` 命令管理
- 若本地 DB 不可达或无法跑 `migrate dev`，停下来让用户执行，不要手写或伪造 migration SQL

### TypeScript 规范 (ESLint 自动拦截)
- **禁止使用 `any`**: 使用 `unknown` 或具体类型代替 (`@typescript-eslint/no-explicit-any`)
- **禁止使用 `enum`**: 使用 `const` 对象 + `as const` 或联合类型代替 (`no-restricted-syntax`)

### i18n 规范
- **禁止在 Service 层硬编码错误消息** — 使用 `AppError` + 错误码
- **禁止在组件中硬编码 UI 文案** — 使用 `useTranslations()`
- **禁止硬编码货币符号** — 使用 `useFormatPrice()` / `useDashboardFormatPrice()`
- 新增错误码时同步更新 `error-codes.ts` 和 `shared/en.json`

### 图片使用规范

- 本项目**不使用** Next.js 图片优化（`images.unoptimized: true`），依赖 CDN 自带的图片优化能力
- 统一使用原生 `<img>` 元素，**禁止** `import Image from "next/image"`
- 不需要维护 `remotePatterns` 白名单
- 首屏关键图（Hero、Logo）可加 `loading="eager"`；其余图默认浏览器原生 lazy-load

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

### URL 路由规范

**必须严格区分品牌级 (`/{companySlug}`) 和门店级 (`/r/{merchantSlug}`) 路由**。详细规范和代码示例见 [routing.md](.claude/docs/routing.md)。

## Claude Code Skills

| Skill | 命令 | 说明 |
|-------|------|------|
| review-i18n | `/review-i18n` | 检查代码中是否有硬编码的货币符号和 locale |
