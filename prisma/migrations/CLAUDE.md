# Migration 目录说明

**禁止手写 migration SQL 文件。** 此目录下的所有文件由 Prisma 自动生成和管理。

## 正确的数据库变更流程

1. 修改 `prisma/schema.prisma`
2. 运行 `npm run db:migrate`，Prisma 会自动生成正确的 MySQL SQL
3. 如需在生成的 migration 基础上追加数据迁移逻辑，可以编辑已生成的 `migration.sql`，但不要从零手写

## 为什么不能手写

Prisma 生成的 MySQL SQL 包含许多容易写错的细节：
- 标识符使用反引号 `` ` `` 而非双引号
- `VARCHAR(191)` 是 Prisma 对 MySQL 的默认字符串长度
- 时间戳使用 `DATETIME(3)` 带毫秒精度
- 表必须带 `DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
- 索引命名遵循 `{table}_{columns}_idx` / `{table}_{columns}_key` 约定

手写 SQL 频繁出现语法错误，让 Prisma 生成才能保证正确性。
