# Landing Page to Onboarding Flow — Design Spec

**Issue:** #20  
**Date:** 2026-04-09  
**Status:** Draft

## Overview

设计从 landing page 生成临时网站到付费用户转化的 claim/onboarding 流程，最大化转化率。

## 用户流程

```
Landing Page (calculator/generator)
  → 用户搜索餐厅，生成临时网站（tenant subscriptionStatus = "trial"）
  → 重定向到 /{companySlug}（临时网站）
  → 浏览网站，底部浮动 Claim Bar 始终可见
  → 点击 "Claim Now" CTA
  → 弹出 Claim Modal（邮箱 + 密码 + 确认密码）
  → 提交注册
  → 跳转到 /claim/success?company={companySlug} 成功页
  → 点击 "Set Up Your Restaurant" → 进入 /dashboard
  → 触发现有 3 步 onboarding 流程（website build → menu build → online ordering）
```

## 组件设计

### 1. ClaimBar — 浮动底部 Bar

**文件：** `src/components/storefront/ClaimBar.tsx`

**展示条件：**
- `subscriptionStatus === "trial"`
- 用户未登录

**UI 规格：**
- 固定在视口底部（`position: fixed`）
- 背景：`bg-theme-primary`，文字：`text-theme-primary-foreground`
- 按钮：白色背景 + `text-theme-primary` 文字
- 文案：`"This is your restaurant? Claim your free website now!"`
- 按钮文案：`"Claim Now →"`
- 移动端文案缩短为：`"Claim your free website!"`
- 可关闭（X 按钮），关闭后 session 内不再显示（sessionStorage）

**Props：**
```typescript
interface ClaimBarProps {
  tenantId: string;
  companySlug: string;
}
```

### 2. ClaimModal — 注册弹窗

**文件：** `src/components/storefront/ClaimModal.tsx`

**触发：** 点击 ClaimBar 的 "Claim Now" 按钮

**表单字段：**
- Email（必填，邮箱格式校验）
- Password（必填，最少 8 位）
- Confirm Password（必填，与 Password 一致）

**UI 规格：**
- 居中 modal，移动端全屏
- 标题：`"Claim Your Restaurant Website"`
- 副标题：`"Create your account to manage your website"`
- 底部小字：`"Already have an account? Log in"`（链接到 `/dashboard/login`）

**交互流程：**
1. 前端 Zod 校验
2. 调用 `POST /api/auth/claim`（传 tenantId + email + password）
3. 成功后自动登录（NextAuth `signIn`）
4. 跳转到 `/claim/success?company={companySlug}`

**错误处理：**
- 邮箱已被注册 → `"This email is already in use"`
- Tenant 已被 claim → `"This website has already been claimed"`
- 网络错误 → 通用错误提示

### 3. Claim 成功页

**路由：** `src/app/(platform)/claim/success/page.tsx`  
**URL：** `/claim/success?company={companySlug}`

**页面内容：**
- 成功图标（checkmark）
- 标题：`"Congratulations!"`
- 副标题：`"Your website is now active."`
- 网站链接预览（可点击，新窗口打开）
- 主 CTA：`"Set Up Your Restaurant →"` → 跳转 `/dashboard`

**逻辑：**
- 需要已登录状态，未登录重定向到 `/dashboard/login`
- 从 `companySlug` query param 获取 company 信息展示网站链接

## API 变更

### `POST /api/auth/claim` — 扩展现有接口

**Request Body（扩展后）：**
```typescript
{
  tenantId: string;
  email: string;
  password: string;
}
```

**Response：**
```typescript
{
  success: true;
  userId: string;
  companySlug: string;
}
```

**后端逻辑：**
1. Zod 校验请求体
2. 检查 tenant 存在且 `subscriptionStatus === "trial"`
3. 检查 email 未被占用（全局唯一）
4. bcrypt 哈希密码
5. 创建 User（role = "owner", tenantId, companyId）
6. 更新 tenant `subscriptionStatus` → `"active"`
7. 返回 userId + companySlug

## 数据流

**Storefront Layout → ClaimBar → ClaimModal** 的数据传递：

```
StorefrontLayout (已有 tenant/company 数据)
  ├── ... (现有页面内容)
  └── ClaimBar (条件渲染: trial && 未登录)
        └── ClaimModal (state 控制显示/隐藏)
              └── POST /api/auth/claim
                    → signIn()
                    → router.push(/claim/success?company={slug})
```

**传递数据：**
- `tenantId` — 来自 storefront layout 查询
- `subscriptionStatus` — 判断是否展示 ClaimBar
- `companySlug` — 成功后跳转用

## 涉及文件

| 类型 | 路径 | 说明 |
|------|------|------|
| 新增 | `src/components/storefront/ClaimBar.tsx` | 浮动底部 claim bar |
| 新增 | `src/components/storefront/ClaimModal.tsx` | Claim 注册 modal |
| 新增 | `src/app/(platform)/claim/success/page.tsx` | Claim 成功页 |
| 修改 | `src/app/api/auth/claim/route.ts` | 扩展接口支持 email/password |
| 修改 | `src/app/(storefront)/[companySlug]/layout.tsx` | 添加 ClaimBar |
| 修改 | `src/app/(storefront)/r/[merchantSlug]/layout.tsx` | 添加 ClaimBar |

## 设计决策记录

| 决策 | 选择 | 原因 |
|------|------|------|
| Claim 入口 | 浮动底部 bar | 始终可见，不影响浏览 |
| Claim 交互 | Modal 弹窗 | 不离开当前页面，摩擦最低 |
| 注册方式 | 邮箱 + 密码 | MVP 方案，后续接入 Stytch（#54） |
| 注册字段 | 仅邮箱/密码 | 轻量级，转化率最高 |
| Claim 后跳转 | 独立成功页 → dashboard | 心理过渡，增强成就感 |
| 临时网站生命周期 | 永久保留 | 减少实现复杂度 |
| CTA 文案风格 | 营销感 | 提升点击率 |

## 不在范围内

- Stytch / Magic Link / OAuth 登录（见 #54）
- 临时网站过期机制
- 付费订阅计划选择（onboarding 后续流程）
- 邮件通知（claim 确认邮件等）
