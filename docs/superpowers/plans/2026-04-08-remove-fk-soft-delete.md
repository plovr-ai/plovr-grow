# 移除数据库外键约束，补全软删除字段 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将数据库外键约束迁移至 Prisma 应用层管理，补全缺失的软删除字段和外键索引。

**Architecture:** 在 Prisma datasource 中启用 `relationMode = "prisma"`，移除所有 `@relation` 中的 `onDelete` 策略，为缺失外键索引的字段添加 `@@index`，为 `WebsiteGeneration` 和 `Lead` 表添加 `deleted` 字段。

**Tech Stack:** Prisma ORM, MySQL

---

### Task 1: 添加 `relationMode = "prisma"` 并移除所有 `onDelete` 策略

**Files:**
- Modify: `prisma/schema.prisma:5-8` (datasource block)
- Modify: `prisma/schema.prisma` (all lines with `onDelete`)

- [ ] **Step 1: 在 datasource 中添加 relationMode**

修改 `prisma/schema.prisma` 的 datasource block：

```prisma
datasource db {
  provider     = "mysql"
  url          = env("DATABASE_URL")
  relationMode = "prisma"
}
```

- [ ] **Step 2: 移除所有 `onDelete: Restrict`**

搜索并替换所有 `, onDelete: Restrict`，从 `@relation` 中移除。共 66 处。

示例变更：
```prisma
// 变更前
tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Restrict)

// 变更后
tenant Tenant @relation(fields: [tenantId], references: [id])
```

- [ ] **Step 3: 移除 `onDelete: SetNull`**

`WebsiteGeneration` 模型（第 892 行）有一处 `onDelete: SetNull`，也需移除：

```prisma
// 变更前
tenant Tenant? @relation(fields: [tenantId], references: [id], onDelete: SetNull)

// 变更后
tenant Tenant? @relation(fields: [tenantId], references: [id])
```

- [ ] **Step 4: 验证没有遗漏的 onDelete**

```bash
grep -n "onDelete" prisma/schema.prisma
```

Expected: 无输出（所有 onDelete 已移除）

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "refactor: add relationMode prisma and remove all onDelete strategies (#34)"
```

---

### Task 2: 补全缺失的外键索引

**Files:**
- Modify: `prisma/schema.prisma`

`relationMode = "prisma"` 不自动创建外键索引，需手动确保所有外键字段都有 `@@index`。以下 4 处缺失：

- [ ] **Step 1: 为 PointTransaction 添加缺失索引**

在 `PointTransaction` 模型（约第 458-461 行）的 `@@index` 区域添加：

```prisma
  @@index([merchantId])
  @@index([orderId])
```

添加后该模型的索引部分为：
```prisma
  @@unique([tenantId, orderId, type], map: "point_transactions_tenant_order_type_unique")
  @@index([tenantId])
  @@index([memberId])
  @@index([merchantId])
  @@index([orderId])
  @@map("point_transactions")
```

- [ ] **Step 2: 为 CateringOrder 添加缺失索引**

在 `CateringOrder` 模型（约第 579-584 行）的 `@@index` 区域添加：

```prisma
  @@index([leadId])
```

添加后该模型的索引部分为：
```prisma
  @@index([tenantId])
  @@index([merchantId])
  @@index([leadId])
  @@index([status])
  @@index([merchantId, status])
  @@index([merchantId, eventDate])
  @@map("catering_orders")
```

- [ ] **Step 3: 为 WebsiteGeneration 添加缺失索引**

在 `WebsiteGeneration` 模型（约第 894 行）添加：

```prisma
  @@index([tenantId])
```

添加后该模型的索引部分为：
```prisma
  @@index([tenantId])
  @@index([placeId, status])
  @@map("website_generations")
```

- [ ] **Step 4: 验证所有外键字段都有索引**

对照所有 `@relation(fields: [...])` 中的字段，确认每个都有对应的 `@@index` 或 `@@unique` 或 `@unique`。

注意：以下字段通过 `@unique` 或 `@@unique` 已有索引，无需额外添加 `@@index`：
- `StripeConnectAccount.tenantId` — `@unique`
- `Subscription.tenantId` — `@unique`
- `GiftCard.purchaseOrderId` — `@unique`
- `Invoice.cateringOrderId` — `@unique`
- `StripeCustomer.loyaltyMemberId` — `@unique`

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "refactor: add missing FK indexes for relationMode prisma (#34)"
```

---

### Task 3: 补全软删除字段

**Files:**
- Modify: `prisma/schema.prisma` (WebsiteGeneration 和 Lead 模型)

- [ ] **Step 1: 为 WebsiteGeneration 添加 deleted 字段**

在 `WebsiteGeneration` 模型（约第 888-889 行之间）添加 `deleted` 字段：

```prisma
model WebsiteGeneration {
  id           String   @id @default(cuid())
  placeId      String   @map("place_id")
  placeName    String   @map("place_name")
  status       String   @default("pending")
  stepDetail   String?  @map("step_detail")
  googleData   Json?    @map("google_data")
  tenantId     String?  @map("tenant_id")
  companySlug  String?  @map("company_slug")
  errorMessage String?  @map("error_message") @db.Text
  deleted      Boolean  @default(false)
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  tenant       Tenant?  @relation(fields: [tenantId], references: [id])

  @@index([tenantId])
  @@index([placeId, status])
  @@map("website_generations")
}
```

- [ ] **Step 2: 为 Lead 添加 deleted 和 updatedAt 字段**

`Lead` 模型当前也缺少 `updatedAt` 字段，为保持一致性一并添加：

```prisma
model Lead {
  id          String   @id @default(cuid())
  email       String
  revenue     Float
  aov         Float
  platform    String
  monthlyLoss Float    @map("monthly_loss")
  deleted     Boolean  @default(false)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@map("leads")
}
```

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add deleted field to WebsiteGeneration and Lead tables (#34)"
```

---

### Task 4: 生成 Prisma Client 并验证构建

**Files:**
- Generated: `node_modules/.prisma/client/`

- [ ] **Step 1: 生成 Prisma Client**

```bash
npx prisma generate
```

Expected: `✔ Generated Prisma Client`

- [ ] **Step 2: TypeScript 类型检查**

```bash
npx tsc --noEmit
```

Expected: 无错误输出

- [ ] **Step 3: 运行 lint**

```bash
npm run lint
```

Expected: 无错误

- [ ] **Step 4: 运行测试**

```bash
npm run test:run
```

Expected: 所有测试通过

- [ ] **Step 5: Commit（如有修复）**

如果类型检查或测试发现需要修复的问题，修复后提交：

```bash
git add <changed-files>
git commit -m "fix: resolve type/test issues from schema changes (#34)"
```
