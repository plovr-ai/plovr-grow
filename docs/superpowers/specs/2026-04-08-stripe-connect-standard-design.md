# Stripe Connect Standard 对接设计

> Issue: #15 — 重新对接 Stripe Standard 模式
> Date: 2026-04-08

## 概述

将平台支付从 Stripe 直连模式迁移到 **Stripe Connect Standard** 模式。每个租户（餐厅）拥有自己的 Stripe 账户，通过 OAuth 授权接入平台，顾客支付资金直接进入餐厅账户。

## 核心决策

| 决策 | 结论 |
|------|------|
| Connect 模式 | Standard（餐厅自带完整 Stripe 账户） |
| 平台收费方式 | 不从交易抽成，仅通过订阅费盈利 |
| 订阅系统 | 保持不变，仍走平台 Stripe 账户 |
| Onboarding | 注册时强制连接 Stripe 账户 |
| 未连接时行为 | 仅支持 Cash 支付，在线支付不可用 |
| Saved cards | 搁置（见 #16），本次不处理 |
| 架构模式 | Strategy Pattern — PaymentProvider 接口 |

## 1. 数据库变更

### 1.1 新增 StripeConnectAccount 模型

```prisma
model StripeConnectAccount {
  id                    String    @id
  tenantId              String    @unique @map("tenant_id")
  stripeAccountId       String    @unique @map("stripe_account_id")  // acct_xxx

  // OAuth 数据
  accessToken           String?   @map("access_token")     // 加密存储
  refreshToken          String?   @map("refresh_token")    // 加密存储
  scope                 String?                             // read_write

  // 账户状态
  chargesEnabled        Boolean   @default(false) @map("charges_enabled")
  payoutsEnabled        Boolean   @default(false) @map("payouts_enabled")
  detailsSubmitted      Boolean   @default(false) @map("details_submitted")

  // 时间戳
  connectedAt           DateTime? @map("connected_at")
  disconnectedAt        DateTime? @map("disconnected_at")
  deleted               Boolean   @default(false)
  createdAt             DateTime  @default(now()) @map("created_at")
  updatedAt             DateTime  @updatedAt @map("updated_at")

  tenant                Tenant    @relation(fields: [tenantId], references: [id])

  @@index([stripeAccountId])
  @@map("stripe_connect_accounts")
}
```

### 1.2 Payment 模型新增字段

```prisma
stripeAccountId       String?   @map("stripe_account_id")  // 关联的 connected account
```

### 1.3 Tenant 模型新增字段

```prisma
stripeConnectStatus   String?   @map("stripe_connect_status")  // connected | pending | disconnected
```

## 2. PaymentProvider 接口设计

### 2.1 核心接口

```typescript
// src/services/payment/payment-provider.types.ts

interface PaymentProvider {
  readonly type: 'stripe_connect_standard' | 'stripe_connect_express';

  // 支付操作
  createPaymentIntent(input: CreatePaymentIntentInput): Promise<CreatePaymentIntentResult>;
  retrievePaymentIntent(paymentIntentId: string, stripeAccountId?: string): Promise<PaymentIntentInfo>;

  // Webhook
  verifyWebhookSignature(payload: string, signature: string): Promise<StripeEvent>;

  // 客户管理（#16 实现时启用）
  // createCustomer(input: CreateCustomerInput): Promise<string>;
  // listPaymentMethods(customerId: string): Promise<PaymentMethodInfo[]>;
  // detachPaymentMethod(paymentMethodId: string): Promise<void>;
}
```

### 2.2 Connect 账户管理（独立接口）

```typescript
// src/services/stripe-connect/stripe-connect.types.ts

interface ConnectAccountManager {
  generateOAuthUrl(tenantId: string, redirectUri: string): string;
  handleOAuthCallback(code: string, tenantId: string): Promise<ConnectAccountInfo>;
  getAccountStatus(stripeAccountId: string): Promise<AccountStatus>;
  disconnectAccount(tenantId: string): Promise<void>;
  isAccountReady(tenantId: string): Promise<boolean>;
}
```

### 2.3 Provider 工厂

```typescript
// src/services/payment/payment-provider.factory.ts

function createPaymentProvider(type: string): PaymentProvider {
  switch (type) {
    case 'stripe_connect_standard':
      return new StripeConnectStandardProvider();
    default:
      throw new AppError('UNSUPPORTED_PAYMENT_PROVIDER');
  }
}
```

## 3. Connect OAuth Onboarding 流程

### 3.1 流程

```
餐厅注册 → 填写基本信息 → 点击 "连接 Stripe 账户"
  → 跳转 Stripe OAuth 授权页面
  → 餐厅登录/创建 Stripe 账户并授权
  → 回调到 /api/auth/stripe/callback
  → 保存 stripeAccountId + tokens
  → 更新 Tenant.stripeConnectStatus = "connected"
  → 注册完成
```

### 3.2 API 路由

```
GET  /api/auth/stripe/connect      → 生成 OAuth URL 并重定向
GET  /api/auth/stripe/callback      → 处理 OAuth 回调
```

### 3.3 安全

- `state` 参数携带加密的 `tenantId`，防止 CSRF
- `stripe_landing=register` 引导新用户直接创建账户
- tokens 加密存储

### 3.4 未连接时行为

- 在线点餐：仅显示 Cash 支付选项
- Dashboard 提示："请连接 Stripe 账户以启用在线支付"
- 菜单正常展示，不影响浏览

## 4. 支付流程变更

### 4.1 点餐支付流程

```
POST /api/storefront/r/[slug]/payment-intent
  ├─ 查询 Merchant → Tenant → StripeConnectAccount
  ├─ 检查 chargesEnabled == true ?
  │    ├─ YES → PaymentProvider.createPaymentIntent()
  │    │         → stripe.paymentIntents.create({ stripeAccount: connectedAccountId })
  │    └─ NO → 返回错误，前端仅展示 Cash 选项
  ↓
前端 loadStripe(publishableKey, { stripeAccount: connectedAccountId })
  ↓
支付完成 → 资金直接进入餐厅 Stripe 账户
```

### 4.2 Cash 支付路径

- 订单 `paymentMethod = "cash"`
- 不创建 PaymentIntent
- Payment 记录 `status = "pending"`，待到店确认

### 4.3 与直连模式的差异

| 维度 | 直连（旧） | Connect Standard（新） |
|------|-----------|----------------------|
| PaymentIntent 创建 | 平台 Stripe 账户 | Connected Account |
| 前端 loadStripe | 仅 publishableKey | publishableKey + stripeAccount |
| 资金流向 | 平台账户 | 餐厅账户 |
| Webhook | 平台账户事件 | Connect webhook |
| Application Fee | 无 | 无（纯订阅盈利） |

## 5. Webhook 变更

### 5.1 路由分离

```
POST /api/webhooks/stripe          → 平台事件（订阅相关，保持不变）
POST /api/webhooks/stripe-connect  → Connect 事件（点餐支付相关）
```

### 5.2 Connect Webhook 事件

```
payment_intent.succeeded      → 更新 Payment 状态
payment_intent.payment_failed → 更新 Payment 状态 + 失败信息
account.updated               → 更新 StripeConnectAccount 状态
```

### 5.3 新增环境变量

```
STRIPE_CONNECT_WEBHOOK_SECRET=whsec_xxx
STRIPE_CLIENT_ID=ca_xxx
```

## 6. 代码清理

### 6.1 需要清理的直连代码

| 文件 | 操作 |
|------|------|
| `StripeService` | 移除直连 PaymentIntent 逻辑，重构为 Connect 模式 |
| `PaymentService` | 移除直连 createPaymentIntent / verifyPayment |
| `payment-intent/route.ts` | 重写为 Connect 模式 |
| `webhooks/stripe/route.ts` | 仅保留订阅事件，支付事件移到 connect webhook |
| `StripeProvider.tsx` | 适配 stripeAccount 参数 |
| `CardPaymentForm.tsx` | 适配 Connect 模式 |
| `usePaymentIntent.ts` | 适配新 API 响应 |
| Mock 模式 | 适配 Connect 模式 mock 数据 |

### 6.2 保留不动

| 文件 | 原因 |
|------|------|
| 订阅相关代码 | 仍走平台账户 |
| StripeCustomer 相关 | 搁置到 #16 |
| Payment 模型基本结构 | 只新增字段 |

## 7. 服务层架构

### 7.1 目录结构

```
src/services/
  ├─ payment/
  │    ├─ payment-provider.types.ts          # PaymentProvider 接口
  │    ├─ payment-provider.factory.ts        # Provider 工厂
  │    ├─ payment.service.ts                 # 重构：通过 Provider 处理支付
  │    └─ payment.types.ts
  ├─ stripe-connect/
  │    ├─ index.ts
  │    ├─ stripe-connect.service.ts          # Connect 账户管理
  │    ├─ stripe-connect.types.ts
  │    └─ stripe-connect-standard.provider.ts  # PaymentProvider 实现
  ├─ stripe/
  │    ├─ stripe.service.ts                  # 精简：仅底层 Stripe API 封装
  │    └─ stripe.types.ts
  └─ subscription/                           # 不变
```

### 7.2 调用关系

```
API Route → PaymentService → PaymentProvider → StripeConnectStandardProvider → StripeService
API Route (OAuth) → StripeConnectService → StripeService
```

### 7.3 新增 Repository

```
src/repositories/
  ├─ stripe-connect-account.repository.ts    # 新增
  └─ payment.repository.ts                   # 适配新字段
```

## 8. 前端变更

### 8.1 StripeProvider 适配

```tsx
// 需要传入 connected account
const stripePromise = loadStripe(publishableKey, {
  stripeAccount: connectedAccountId,
});
```

### 8.2 payment-intent API 响应

```typescript
// 改后返回
{ clientSecret, paymentIntentId, stripeAccountId }
```

### 8.3 Checkout 页面逻辑

```
查询餐厅 Connect 状态
  ├─ 已连接且 chargesEnabled → Card + Cash 选项
  └─ 未连接或未启用 → 仅 Cash 选项
```

### 8.4 Dashboard 新增

**设置 > Stripe 连接**页面：
- 显示连接状态
- 已连接：Stripe 账户 ID + 断开按钮
- 未连接：连接按钮 → OAuth 流程
