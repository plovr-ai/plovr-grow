# 合并 Tenant 与 Company 模型 — 设计文档

**日期**: 2026-04-10
**状态**: 已批准

## 背景

当前架构中 Tenant 和 Company 是 1:1 关系，Tenant 管理订阅/计费，Company 管理品牌信息。这层间接关系导致：

- 几乎所有业务表同时持有 `tenantId` 和 `companyId`，查询时需要两步跳转
- Service 层方法频繁接受 `(tenantId, companyId)` 双参数
- 创建租户时必须同时创建两个实体

由于目标客户是独立餐厅或单品牌连锁店，1:N 的可能性不存在，合并是合理的简化。

## 设计决策

| 决策点 | 结论 |
|--------|------|
| 隔离键命名 | 保留 `tenantId`，改动量最小 |
| slug 字段名 | 模型上用 `slug`，路由参数保持 `companySlug` |
| `legalName` 字段 | 删除，暂不需要 |
| 子表 `companyId` | 直接删除，只保留 `tenantId` |
| 迁移策略 | 一步到位，不做渐进式迁移 |

## 数据模型变更

### 合并后的 Tenant 模型

```prisma
model Tenant {
  // 身份
  id                      String     @id
  name                    String                    // 品牌名
  slug                    String     @unique        // 公开路由用

  // 订阅/计费（原 Tenant）
  subscriptionPlan        String     @default("free")
  subscriptionStatus      String     @default("active")
  stripeConnectStatus     String?

  // 品牌信息（原 Company）
  description             String?
  logoUrl                 String?
  websiteUrl              String?
  supportEmail            String?
  supportPhone            String?
  currency                String     @default("USD")
  locale                  String     @default("en-US")
  timezone                String     @default("America/New_York")
  status                  String     @default("active")
  settings                Json?
  source                  String?

  // Onboarding（原 Company）
  onboardingStatus        String     @default("not_started")
  onboardingData          Json?
  onboardingCompletedAt   DateTime?

  // 通用
  deleted                 Boolean    @default(false)
  createdAt               DateTime   @default(now())
  updatedAt               DateTime   @updatedAt

  // 关系（原 Company + Tenant 的合集）
  merchants               Merchant[]
  menus                   Menu[]
  menuCategories          MenuCategory[]
  menuItems               MenuItem[]
  orders                  Order[]
  users                   User[]
  taxConfigs              TaxConfig[]
  loyaltyConfig           LoyaltyConfig?
  loyaltyMembers          LoyaltyMember[]
  pointTransactions       PointTransaction[]
  otpVerifications        OtpVerification[]
  featuredItems           FeaturedItem[]
  cateringLeads           CateringLead[]
  cateringOrders          CateringOrder[]
  invoices                Invoice[]
  giftCards               GiftCard[]
  giftCardTransactions    GiftCardTransaction[]
  orderSequences          OrderSequence[]
  companyOrderSequences   CompanyOrderSequence[]
  cateringOrderSequences  CateringOrderSequence[]
  invoiceSequences        InvoiceSequence[]
  stripeConnectAccount    StripeConnectAccount?
  stripeCustomers         StripeCustomer[]
}
```

### 删除

- `Company` 模型整体删除

### 子表变更（14 个模型）

所有原来同时持有 `tenantId` + `companyId` 的表，删除 `companyId` 字段及其关系和索引：

- Menu
- MenuCategory
- MenuItem
- Merchant
- Order
- User（`companyId` 原为 nullable，删除）
- TaxConfig
- LoyaltyConfig（`companyId` 上的 `@unique` 改为 `tenantId` 上的 `@unique`）
- LoyaltyMember（unique 约束从 `[tenantId, companyId, phone]` 改为 `[tenantId, phone]`）
- FeaturedItem（unique 约束从 `[companyId, menuItemId]` 改为 `[tenantId, menuItemId]`）
- CompanyOrderSequence（unique 约束从 `[tenantId, companyId, date]` 改为 `[tenantId, date]`）
- GiftCard
- StripeCustomer

## 代码层变更

### 1. 删除文件

- `src/services/company/` — 整个目录
- `src/repositories/company.repository.ts`
- `src/types/company.ts` — 类型定义迁移到新建的 `src/types/tenant.ts`

### 2. 新建/改造 Tenant Service

创建 `src/services/tenant/tenant.service.ts`，合并原 CompanyService 的方法：

```typescript
class TenantService {
  async createTenant(input: CreateTenantInput): Promise<TenantInfo>
  async getTenant(tenantId: string): Promise<TenantInfo>
  async getTenantBySlug(slug: string): Promise<TenantInfo>
  async updateTenant(tenantId: string, input: UpdateTenantInput): Promise<TenantInfo>
  async deleteTenant(tenantId: string): Promise<void>

  // Onboarding
  async initializeOnboarding(tenantId: string): Promise<void>
  async updateOnboardingStep(tenantId: string, stepId, status): Promise<void>
  async getOnboardingStatus(tenantId: string): Promise<OnboardingStatus>
  async dismissOnboarding(tenantId: string): Promise<void>

  // Merchant 管理
  async createMerchant(tenantId: string, input: CreateMerchantInput): Promise<MerchantInfo>
  async getMerchants(tenantId: string): Promise<MerchantInfo[]>
  async getActiveMerchants(tenantId: string): Promise<MerchantInfo[]>
}
```

### 3. 新建 Tenant Repository

创建 `src/repositories/tenant.repository.ts`，合并原 CompanyRepository 的方法，所有查询改用 Prisma 的 `tenant` 模型。

### 4. 其他 Service 层

所有接受 `(tenantId, companyId, ...)` 双参数的方法，删除 `companyId` 参数。涉及的 service：

- MenuService
- MerchantService
- LoyaltyService / LoyaltyConfigService / LoyaltyMemberService
- GiftCardService
- OrderService
- PaymentService
- CateringService / CateringOrderService
- TaxConfigService
- AuthService
- GeneratorService
- DashboardAgentService
- SquareService

### 5. Repository 层

所有 repository 中的 `where: { companyId }` 改为 `where: { tenantId }`，移除 `companyId` 的 include/select。

### 6. API 路由

- `[companySlug]` 路由参数名不变，公开 URL 格式不变
- 解析逻辑从 `companyRepository.getBySlug()` 改为 `tenantRepository.getBySlug()`
- 所有从 company 对象取 `tenantId` 的地方改为直接用 tenant 对象的 `id`

### 7. Session / Auth

- 删除 `session.user.companyId`
- 确保 `session.user.tenantId` 存在并在所有 dashboard 路由中使用

### 8. Dashboard UI

- `/dashboard/company/` 路径可保留或改为 `/dashboard/settings/`
- 组件中面向用户的文案保持 "Company" / "公司"（UI 层不需要跟内部模型一致）
- `CompanyInfoCard`, `CompanySettingsForm` 等组件内部逻辑改用 tenant 数据

### 9. 类型定义

原 `CompanyInfo`, `CompanySettings`, `CompanyWithMerchants` 等类型重命名为 `TenantInfo`, `TenantSettings`, `TenantWithMerchants`，移至 `src/types/tenant.ts`。

### 10. Context

- `MerchantContext` 中的 `companyId` 字段删除（已有 `tenantId`）
- `LoyaltyContext` 中的 `companyId` 改为 `tenantId`
- `DashboardContext` 中的 company 引用改为 tenant

### 11. Seed 文件

- 不再创建 Company 记录
- 直接在 Tenant 上设置 slug、品牌字段
- 子表的 `companyId` 引用全部改为 `tenantId`

## 不变的部分

- 公开 URL 结构：`/{companySlug}` 和 `/r/{merchantSlug}` 不变
- `tenantId` 作为所有 service 方法的第一个参数的约定不变
- Merchant 模型不变（只是 `companyId` 改为 `tenantId`）
- 前端用户看到的 "Company" 文案可以保持不变

## 影响范围

| 类别 | 数量 |
|------|------|
| Prisma 模型变更 | 15 个（1 删除 + 14 个子表移除 companyId） |
| Service 文件 | ~15 个 |
| Repository 文件 | ~13 个 |
| API 路由 | ~31 个 |
| 类型定义 | ~25 个 |
| React Context | 3 个 |
| 组件文件 | ~30 个 |
| 测试文件 | ~20 个 |
| Seed 文件 | 1 个 |
