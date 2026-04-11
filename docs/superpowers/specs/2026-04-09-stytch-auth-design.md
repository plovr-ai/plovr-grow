# Stytch 登录注册集成设计

## 概述

将现有 NextAuth + Credentials（邮箱/密码）认证渐进迁移至 Stytch，新增 Magic Link 和 Google OAuth 登录方式，同时保留密码登录作为过渡。

## 策略：渐进迁移

- 新增 Stytch 作为额外认证方式（Magic Link + Google OAuth）
- 密码登录并行保留
- 现有用户不受影响，可自然过渡到 Stytch 认证
- 后续根据用户采用情况决定何时移除密码登录

## UI 方案：Stytch Pre-built UI

使用 Stytch 提供的 `<StytchLogin>` 预构建组件，开箱即用。

## Session 兼容机制

**核心原则：Stytch 只在「认证瞬间」参与，认证完成后全程由 NextAuth JWT 管理。**

```
Stytch 认证成功 → callback 路由验证 token → signIn() 生成 NextAuth JWT → Stytch token 丢弃
```

三种登录方式的统一出口：

| 登录方式 | 认证层 | 最终产出 |
|----------|--------|----------|
| 密码 | NextAuth Credentials provider | NextAuth JWT |
| Magic Link | Stytch → callback → signIn() | NextAuth JWT |
| Google OAuth | Stytch → callback → signIn() | NextAuth JWT |

所有路径产出同一个 NextAuth JWT（`{id, email, name, role, tenantId, companyId}`），middleware 和下游代码零改动。

## 数据模型变化

### User 表

```prisma
model User {
  // 现有字段不变，以下为变更：
  passwordHash String?   @map("password_hash")  // 必填 → 可选（Stytch 用户无密码）
  stytchUserId String?   @unique @map("stytch_user_id")  // 新增，关联 Stytch 用户 ID
}
```

- `passwordHash` 改为可选：Stytch 用户没有密码
- `stytchUserId` 新增：用于关联 Stytch 侧用户，唯一索引
- 现有用户数据不受影响

## Stytch Callback 用户处理

```
Stytch callback 收到 token
  → Stytch SDK 验证 → 拿到 { email, stytchUserId }
  │
  ├── 数据库找到 email 匹配的用户
  │     → 更新 stytchUserId（首次关联）
  │     → signIn() 生成 JWT
  │
  └── 数据库未找到该 email（新用户）
        → 创建 Tenant + Company + User
        → name 使用 email @ 前缀填充
        → passwordHash 为 null
        → status = "active"
        → signIn() 生成 JWT
```

新用户后续可通过 profile 页面修改 name 等信息。

## 前端页面与路由

### 登录页面改造

```
/dashboard/login
┌──────────────────────────────┐
│    <StytchLogin> 组件        │
│    (Magic Link + Google)     │
├──────────────────────────────┤
│          — 或 —              │
├──────────────────────────────┤
│    现有密码登录表单           │
│    [邮箱] [密码] [登录]      │
└──────────────────────────────┘
```

### 新增路由

| 路由 | 类型 | 用途 |
|------|------|------|
| `/api/auth/stytch/callback` | API route | Stytch 认证回调，验证 token → 查找/创建用户 → signIn() |
| `/dashboard/stytch-authenticate` | 页面 | Stytch redirect URL，Magic Link 落地页，读取 token 后调用 callback API |

### 现有路由（不变）

| 路由 | 说明 |
|------|------|
| `/dashboard/login` | 新增 StytchLogin 组件，保留密码表单 |
| `/dashboard/register` | 保留不变（密码注册入口） |
| `/dashboard/forgot-password` | 保留不变 |
| `/dashboard/reset-password` | 保留不变 |

### Middleware 变化

`/dashboard/stytch-authenticate` 需加入公开路由列表（无需认证即可访问）。

## 环境变量

```env
STYTCH_PROJECT_ID=project-xxx
STYTCH_SECRET=secret-xxx
NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN=public-token-xxx
```

## 依赖包

```
stytch          — Stytch Backend SDK（服务端 token 验证）
@stytch/nextjs  — Stytch Next.js SDK（含 Pre-built UI 组件）
```

## 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `prisma/schema.prisma` | 修改 | User 表：passwordHash 改可选，新增 stytchUserId |
| `src/lib/stytch.ts` | 新增 | Stytch client 初始化（前端 + 后端） |
| `src/app/api/auth/stytch/callback/route.ts` | 新增 | Stytch 认证回调 API |
| `src/app/(dashboard)/dashboard/(auth)/stytch-authenticate/page.tsx` | 新增 | Magic Link 落地页 |
| `src/app/(dashboard)/dashboard/(auth)/login/page.tsx` | 修改 | 集成 StytchLogin 组件 |
| `src/services/auth/auth.service.ts` | 修改 | 新增 Stytch 用户查找/创建逻辑 |
| `src/middleware.ts` | 修改 | 公开路由加入 stytch-authenticate |
| `src/lib/auth.ts` | 修改 | authorize 回调兼容无密码用户 |
| `src/types/next-auth.d.ts` | 不变 | JWT/Session 类型无需改动 |
