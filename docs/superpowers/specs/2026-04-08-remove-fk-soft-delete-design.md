# 移除数据库外键约束，补全软删除字段 — 设计文档

## 背景

为适配 PlanetScale 等不支持外键的 Serverless 数据库，需要将外键约束从数据库层迁移到应用层，并统一软删除策略。

## 现状分析

### Prisma Schema
- 33 个业务模型，31 个已有 `deleted Boolean @default(false)` 字段
- 所有 `@relation` 使用 `onDelete: Restrict`（`WebsiteGeneration.tenantId` 除外，使用 `SetNull`）
- 外键字段大部分已有 `@@index`，`WebsiteGeneration` 缺少 `@@index([tenantId])`

### Repository 层
- 所有查询已统一过滤 `deleted: false`
- 删除操作全部使用 `update({ deleted: true, updatedAt: new Date() })`
- 无硬删除代码

## 变更方案

### 1. 添加 `relationMode = "prisma"`

在 `datasource db` 中添加 `relationMode = "prisma"`，将外键管理从数据库层移至 Prisma 应用层。

```prisma
datasource db {
  provider     = "mysql"
  url          = env("DATABASE_URL")
  relationMode = "prisma"
}
```

Prisma 仍会在运行时检查引用完整性（如 `connect` 时验证记录存在），但不再创建数据库级 FK 约束。

### 2. 移除所有 `onDelete` 策略

移除所有 `@relation` 中的 `onDelete: Restrict` 和 `onDelete: SetNull`。因为项目已全面使用软删除，数据库级联删除策略不会被触发，移除后不影响行为。

### 3. 补全外键索引

`relationMode = "prisma"` 模式下，Prisma 不自动创建外键索引。需确认所有外键字段都有 `@@index`。

经排查，仅 `WebsiteGeneration` 缺少 `@@index([tenantId])`，需补上。

### 4. 补全软删除字段

为以下 2 个表添加 `deleted Boolean @default(false)`：

- `WebsiteGeneration`
- `Lead`

### 5. 生成数据库迁移

执行 `npx prisma migrate dev` 生成迁移文件，迁移内容包括：
- 删除所有外键约束
- 添加缺失的索引
- 添加 `deleted` 字段

## 不需要变更的部分

- **Repository 层**：已完全适配软删除模式，无需修改
- **Service 层**：不受影响
- **API 层**：不受影响

## 风险评估

**风险等级：低**

- 应用层行为不变（Prisma 仍在运行时检查引用完整性）
- 现有软删除逻辑完善，不依赖数据库级联
- 唯一实际变化是数据库层面移除 FK 约束
- 新增的 `deleted` 字段默认值为 `false`，对现有数据无影响
