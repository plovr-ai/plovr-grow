# Stytch 登录注册集成 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 渐进迁移认证系统，新增 Stytch Magic Link + Google OAuth 登录，保留现有密码登录，所有登录方式统一产出 NextAuth JWT session。

**Architecture:** Stytch Pre-built UI 处理 Magic Link 和 Google OAuth 认证，认证成功后通过 callback 路由验证 Stytch token 并转换为 NextAuth JWT session。现有 Credentials provider、middleware、session 逻辑不变。

**Tech Stack:** Stytch Next.js SDK (`@stytch/nextjs`), Stytch Backend SDK (`stytch`), NextAuth v5, Prisma

---

### Task 1: 安装依赖 + 环境变量

**Files:**
- Modify: `package.json`
- Modify: `.env.example` (如存在) 或 `.env.local`

- [ ] **Step 1: 安装 Stytch 依赖**

```bash
cd /Users/allan/workspace/plovr/plovr-grow-issue-54
npm install @stytch/nextjs stytch
```

- [ ] **Step 2: 添加环境变量到 `.env.local`**

在 `.env.local` 中添加：

```env
STYTCH_PROJECT_ID=project-test-xxx
STYTCH_SECRET=secret-test-xxx
NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN=public-token-test-xxx
```

注意：实际值需要从 Stytch Dashboard 获取。开发时使用 Stytch Test 环境。

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add stytch and @stytch/nextjs dependencies (#54)"
```

---

### Task 2: 创建 Stytch Client 初始化模块

**Files:**
- Create: `src/lib/stytch.ts`
- Test: `__tests__/lib/stytch.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// __tests__/lib/stytch.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("stytch client", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("getStytchServerClient returns a stytch Client instance", async () => {
    vi.stubEnv("STYTCH_PROJECT_ID", "project-test-123");
    vi.stubEnv("STYTCH_SECRET", "secret-test-456");

    const { getStytchServerClient } = await import("@/lib/stytch");
    const client = getStytchServerClient();
    expect(client).toBeDefined();
    expect(client.sessions).toBeDefined();
  });

  it("throws if STYTCH_PROJECT_ID is missing", async () => {
    vi.stubEnv("STYTCH_PROJECT_ID", "");
    vi.stubEnv("STYTCH_SECRET", "secret-test-456");

    const { getStytchServerClient } = await import("@/lib/stytch");
    expect(() => getStytchServerClient()).toThrow("STYTCH_PROJECT_ID");
  });

  it("throws if STYTCH_SECRET is missing", async () => {
    vi.stubEnv("STYTCH_PROJECT_ID", "project-test-123");
    vi.stubEnv("STYTCH_SECRET", "");

    const { getStytchServerClient } = await import("@/lib/stytch");
    expect(() => getStytchServerClient()).toThrow("STYTCH_SECRET");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm test -- --testPathPattern="__tests__/lib/stytch" --run
```

Expected: FAIL — module not found

- [ ] **Step 3: 实现 Stytch client**

```typescript
// src/lib/stytch.ts
import * as stytch from "stytch";

let serverClient: stytch.Client | null = null;

export function getStytchServerClient(): stytch.Client {
  if (serverClient) return serverClient;

  const projectId = process.env.STYTCH_PROJECT_ID;
  const secret = process.env.STYTCH_SECRET;

  if (!projectId) {
    throw new Error("Missing required environment variable: STYTCH_PROJECT_ID");
  }
  if (!secret) {
    throw new Error("Missing required environment variable: STYTCH_SECRET");
  }

  serverClient = new stytch.Client({
    project_id: projectId,
    secret: secret,
  });

  return serverClient;
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npm test -- --testPathPattern="__tests__/lib/stytch" --run
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/stytch.ts __tests__/lib/stytch.test.ts
git commit -m "feat: add Stytch server client initialization (#54)"
```

---

### Task 3: 数据模型变更 — User 表添加 stytchUserId

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/services/auth/mock-store.ts`

- [ ] **Step 1: 修改 Prisma schema**

在 `prisma/schema.prisma` 的 User model 中：

```prisma
model User {
  id           String    @id
  tenantId     String    @map("tenant_id")
  companyId    String?   @map("company_id")
  email        String
  passwordHash String?   @map("password_hash")    // 改为可选
  stytchUserId String?   @unique @map("stytch_user_id")  // 新增
  name         String
  role         String    @default("staff")
  status       String    @default("active")
  lastLoginAt  DateTime? @map("last_login_at")
  deleted      Boolean   @default(false)
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")
  company      Company?  @relation(fields: [companyId], references: [id])
  tenant       Tenant    @relation(fields: [tenantId], references: [id])

  @@unique([tenantId, email])
  @@index([companyId])
  @@index([tenantId])
  @@map("users")
}
```

变更点：
- `passwordHash` 从 `String` 改为 `String?`
- 新增 `stytchUserId String? @unique @map("stytch_user_id")`

- [ ] **Step 2: 更新 MockUser 接口和 mock-store**

在 `src/services/auth/mock-store.ts` 中：

修改 `MockUser` 接口：
```typescript
export interface MockUser {
  id: string;
  tenantId: string;
  companyId: string | null;
  email: string;
  passwordHash: string | null;   // 改为可选
  stytchUserId: string | null;   // 新增
  name: string;
  role: string;
  status: string;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

在 `mockUserStore` 中新增两个方法：
```typescript
findByStytchUserId(stytchUserId: string): MockUser | undefined {
  for (const user of users.values()) {
    if (user.stytchUserId === stytchUserId) {
      return user;
    }
  }
  return undefined;
},

updateStytchUserId(id: string, stytchUserId: string): void {
  const user = users.get(id);
  if (user) {
    user.stytchUserId = stytchUserId;
    user.updatedAt = new Date();
  }
},
```

同时更新 `create` 方法，在创建用户时确保 `stytchUserId` 默认为 `null`（如 input 中未提供）。

- [ ] **Step 3: 更新 init-test-data.ts 中的测试数据**

确保测试用户数据包含 `stytchUserId: null`。

- [ ] **Step 4: 运行类型检查**

```bash
cd /Users/allan/workspace/plovr/plovr-grow-issue-54
npx tsc --noEmit
```

修复任何因 `passwordHash` 变为可选导致的类型错误。

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma src/services/auth/mock-store.ts src/services/auth/init-test-data.ts
git commit -m "feat: add stytchUserId to User model, make passwordHash optional (#54)"
```

---

### Task 4: AuthService 新增 Stytch 用户处理方法

**Files:**
- Modify: `src/services/auth/auth.service.ts`
- Modify: `src/services/auth/index.ts`
- Test: `__tests__/services/auth/auth.service.stytch.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// __tests__/services/auth/auth.service.stytch.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { authService } from "@/services/auth";
import { mockUserStore, mockTenantStore, mockCompanyStore } from "@/services/auth";

describe("AuthService.findOrCreateStytchUser", () => {
  beforeEach(() => {
    // Clear mock stores - 需要根据 mock-store 的实际清理方法调整
    // 如果没有 clear 方法，需要在 mock-store 中添加
  });

  it("returns existing user when email matches and links stytchUserId", async () => {
    // 先创建一个现有密码用户
    const tenant = mockTenantStore.create("Test Co");
    const company = mockCompanyStore.create(tenant.id, "Test Co");
    mockUserStore.create({
      tenantId: tenant.id,
      companyId: company.id,
      email: "existing@test.com",
      passwordHash: "hashed_pw",
      stytchUserId: null,
      name: "Existing User",
      role: "owner",
      status: "active",
      lastLoginAt: null,
    });

    const result = await authService.findOrCreateStytchUser(
      "existing@test.com",
      "stytch-user-123"
    );

    expect(result.user.email).toBe("existing@test.com");
    expect(result.user.stytchUserId).toBe("stytch-user-123");
    expect(result.user.name).toBe("Existing User");
    expect(result.isNewUser).toBe(false);
  });

  it("creates new user when email not found", async () => {
    const result = await authService.findOrCreateStytchUser(
      "newuser@test.com",
      "stytch-user-456"
    );

    expect(result.user.email).toBe("newuser@test.com");
    expect(result.user.stytchUserId).toBe("stytch-user-456");
    expect(result.user.name).toBe("newuser"); // email prefix
    expect(result.user.passwordHash).toBeNull();
    expect(result.user.role).toBe("owner");
    expect(result.isNewUser).toBe(true);
  });

  it("returns existing user when stytchUserId already linked", async () => {
    // 第一次创建
    await authService.findOrCreateStytchUser(
      "linked@test.com",
      "stytch-user-789"
    );

    // 第二次查找
    const result = await authService.findOrCreateStytchUser(
      "linked@test.com",
      "stytch-user-789"
    );

    expect(result.user.email).toBe("linked@test.com");
    expect(result.isNewUser).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm test -- --testPathPattern="auth.service.stytch" --run
```

Expected: FAIL — `findOrCreateStytchUser` not defined

- [ ] **Step 3: 实现 findOrCreateStytchUser**

在 `src/services/auth/auth.service.ts` 的 `AuthService` class 中新增：

```typescript
/**
 * Find existing user by email or create new user from Stytch authentication
 */
async findOrCreateStytchUser(
  email: string,
  stytchUserId: string
): Promise<{ user: MockUser; isNewUser: boolean }> {
  // 1. 先按 stytchUserId 查找（已关联的用户）
  const existingByStytch = mockUserStore.findByStytchUserId(stytchUserId);
  if (existingByStytch) {
    mockUserStore.updateLastLogin(existingByStytch.id);
    return { user: existingByStytch, isNewUser: false };
  }

  // 2. 按 email 查找（现有密码用户首次用 Stytch 登录）
  const existingByEmail = mockUserStore.findByEmail(email);
  if (existingByEmail) {
    mockUserStore.updateStytchUserId(existingByEmail.id, stytchUserId);
    mockUserStore.updateLastLogin(existingByEmail.id);
    const updated = mockUserStore.findById(existingByEmail.id)!;
    return { user: updated, isNewUser: false };
  }

  // 3. 新用户 — 创建 Tenant + Company + User
  const emailPrefix = email.split("@")[0];
  const companyName = `${emailPrefix}'s Company`;

  const tenant = mockTenantStore.create(companyName);
  const company = mockCompanyStore.create(tenant.id, companyName);
  const user = mockUserStore.create({
    tenantId: tenant.id,
    companyId: company.id,
    email,
    passwordHash: null,
    stytchUserId,
    name: emailPrefix,
    role: "owner",
    status: "active",
    lastLoginAt: new Date(),
  });

  return { user, isNewUser: true };
}
```

在文件顶部确保 `MockUser` 类型已导入（从 `./mock-store`）。

- [ ] **Step 4: 运行测试确认通过**

```bash
npm test -- --testPathPattern="auth.service.stytch" --run
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/auth/auth.service.ts __tests__/services/auth/auth.service.stytch.test.ts
git commit -m "feat: add findOrCreateStytchUser to AuthService (#54)"
```

---

### Task 5: Stytch Callback API Route

**Files:**
- Create: `src/app/api/auth/stytch/callback/route.ts`
- Test: `__tests__/app/api/auth/stytch/callback/route.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// __tests__/app/api/auth/stytch/callback/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock stytch server client
vi.mock("@/lib/stytch", () => ({
  getStytchServerClient: vi.fn(() => ({
    sessions: {
      authenticate: vi.fn(),
    },
  })),
}));

// Mock next-auth signIn
vi.mock("@/lib/auth", () => ({
  signIn: vi.fn(),
}));

// Mock auth service
vi.mock("@/services/auth", () => ({
  authService: {
    findOrCreateStytchUser: vi.fn(),
  },
}));

describe("POST /api/auth/stytch/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 if session_token is missing", async () => {
    const { POST } = await import(
      "@/app/api/auth/stytch/callback/route"
    );

    const request = new Request("http://localhost/api/auth/stytch/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 401 if stytch session authentication fails", async () => {
    const { getStytchServerClient } = await import("@/lib/stytch");
    const mockClient = (getStytchServerClient as ReturnType<typeof vi.fn>)();
    mockClient.sessions.authenticate.mockRejectedValue(new Error("Invalid token"));

    const { POST } = await import(
      "@/app/api/auth/stytch/callback/route"
    );

    const request = new Request("http://localhost/api/auth/stytch/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_token: "invalid-token" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("returns 200 with user data on successful authentication", async () => {
    const { getStytchServerClient } = await import("@/lib/stytch");
    const { authService } = await import("@/services/auth");

    const mockClient = (getStytchServerClient as ReturnType<typeof vi.fn>)();
    mockClient.sessions.authenticate.mockResolvedValue({
      user: {
        user_id: "stytch-user-abc",
        emails: [{ email: "test@example.com" }],
      },
    });

    (authService.findOrCreateStytchUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: {
        id: "user-1",
        email: "test@example.com",
        name: "test",
        role: "owner",
        tenantId: "tenant-1",
        companyId: "company-1",
      },
      isNewUser: false,
    });

    const { POST } = await import(
      "@/app/api/auth/stytch/callback/route"
    );

    const request = new Request("http://localhost/api/auth/stytch/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_token: "valid-token" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.user.email).toBe("test@example.com");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm test -- --testPathPattern="stytch/callback" --run
```

Expected: FAIL — route module not found

- [ ] **Step 3: 实现 callback route**

```typescript
// src/app/api/auth/stytch/callback/route.ts
import { NextResponse } from "next/server";
import { getStytchServerClient } from "@/lib/stytch";
import { authService } from "@/services/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { session_token } = body;

    if (!session_token) {
      return NextResponse.json(
        { error: "Missing session_token" },
        { status: 400 }
      );
    }

    // Verify Stytch session
    const stytchClient = getStytchServerClient();
    let stytchResponse;
    try {
      stytchResponse = await stytchClient.sessions.authenticate({
        session_token,
      });
    } catch {
      return NextResponse.json(
        { error: "Invalid Stytch session" },
        { status: 401 }
      );
    }

    const stytchUser = stytchResponse.user;
    const email = stytchUser.emails[0]?.email;

    if (!email) {
      return NextResponse.json(
        { error: "No email found in Stytch user" },
        { status: 400 }
      );
    }

    // Find or create user in our database
    const { user } = await authService.findOrCreateStytchUser(
      email,
      stytchUser.user_id
    );

    // Return user data for client-side NextAuth signIn
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        companyId: user.companyId,
      },
    });
  } catch (error) {
    console.error("Stytch callback error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npm test -- --testPathPattern="stytch/callback" --run
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/auth/stytch/callback/route.ts __tests__/app/api/auth/stytch/callback/route.test.ts
git commit -m "feat: add Stytch callback API route (#54)"
```

---

### Task 6: NextAuth 添加 Stytch Credentials Provider

**Files:**
- Modify: `src/lib/auth.ts`

- [ ] **Step 1: 在 auth.ts 中添加第二个 Credentials provider**

在 `src/lib/auth.ts` 的 `providers` 数组中，在现有 Credentials provider 之后添加一个专门给 Stytch callback 用的 provider：

```typescript
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { loginSchema } from "@/lib/validations/auth";
import { mockUserStore } from "@/services/auth/mock-store";
import { initTestData } from "@/services/auth/init-test-data";

initTestData().catch(console.error);

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,

  providers: [
    // 现有密码登录 provider
    Credentials({
      id: "credentials",
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const user = mockUserStore.findByEmail(email);

        if (!user || user.status !== "active") return null;
        if (!user.passwordHash) return null; // Stytch 用户无密码

        const isValid = await compare(password, user.passwordHash);
        if (!isValid) return null;

        mockUserStore.updateLastLogin(user.id);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
          companyId: user.companyId,
        };
      },
    }),

    // Stytch 登录 provider — 接收已验证的用户数据
    Credentials({
      id: "stytch",
      name: "stytch",
      credentials: {
        id: { type: "text" },
        email: { type: "email" },
        name: { type: "text" },
        role: { type: "text" },
        tenantId: { type: "text" },
        companyId: { type: "text" },
      },
      async authorize(credentials) {
        // 此 provider 只接收已由 Stytch callback API 验证过的用户数据
        // 不做额外验证，直接返回用户对象用于生成 JWT
        if (!credentials?.id || !credentials?.email) return null;

        return {
          id: credentials.id as string,
          email: credentials.email as string,
          name: (credentials.name as string) || "",
          role: (credentials.role as string) || "owner",
          tenantId: (credentials.tenantId as string) || "",
          companyId: (credentials.companyId as string) || null,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.tenantId = user.tenantId;
        token.companyId = user.companyId;
      }
      return token;
    },

    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.tenantId = token.tenantId as string;
        session.user.companyId = token.companyId as string | null;
      }
      return session;
    },
  },

  pages: {
    signIn: "/dashboard/login",
    error: "/dashboard/login",
  },

  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60,
  },
});
```

关键变更：
- 给现有 Credentials provider 添加 `id: "credentials"`
- 新增 `id: "stytch"` provider，接收已验证的用户数据
- 现有 provider 添加 `if (!user.passwordHash) return null` 防止无密码用户走密码登录

- [ ] **Step 2: 运行类型检查**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: 运行现有测试确保没有回归**

```bash
npm test -- --run
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth.ts
git commit -m "feat: add Stytch credentials provider to NextAuth (#54)"
```

---

### Task 7: Stytch Authenticate 落地页

**Files:**
- Create: `src/app/(dashboard)/dashboard/(auth)/stytch-authenticate/page.tsx`

- [ ] **Step 1: 创建落地页**

这个页面是 Stytch Magic Link 点击后的落地页。Stytch SDK 在此页面自动处理 token 交换。

```typescript
// src/app/(dashboard)/dashboard/(auth)/stytch-authenticate/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useStytch } from "@stytch/nextjs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function StytchAuthenticatePage() {
  const router = useRouter();
  const stytchClient = useStytch();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function authenticate() {
      try {
        // Stytch SDK 自动从 URL 中提取 token 并验证
        const response = await stytchClient.magicLinks.authenticate(
          // token 从 URL query 参数中自动读取
        );

        if (!response.session_token) {
          setError("Authentication failed — no session token");
          return;
        }

        // 调用我们的 callback API 验证 + 查找/创建用户
        const callbackResponse = await fetch("/api/auth/stytch/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_token: response.session_token }),
        });

        if (!callbackResponse.ok) {
          setError("Authentication failed — callback error");
          return;
        }

        const { user } = await callbackResponse.json();

        // 用 NextAuth 的 stytch provider 创建 JWT session
        const result = await signIn("stytch", {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
          companyId: user.companyId,
          redirect: false,
        });

        if (result?.error) {
          setError("Failed to create session");
          return;
        }

        router.push("/dashboard");
        router.refresh();
      } catch {
        setError("Authentication failed. Please try again.");
      }
    }

    authenticate();
  }, [stytchClient, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-red-600">
              Authentication Error
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 mb-4">{error}</p>
            <a
              href="/dashboard/login"
              className="text-blue-600 hover:underline"
            >
              Back to login
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Authenticating...</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-gray-600">Please wait while we verify your identity.</p>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: 更新 middleware 公开路由**

在 `src/middleware.ts` 的 `publicRoutes` 数组中添加：

```typescript
const publicRoutes = [
  "/dashboard/login",
  "/dashboard/register",
  "/dashboard/forgot-password",
  "/dashboard/reset-password",
  "/dashboard/stytch-authenticate",  // 新增
];
```

- [ ] **Step 3: 运行类型检查**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/dashboard/\(auth\)/stytch-authenticate/page.tsx src/middleware.ts
git commit -m "feat: add Stytch authenticate landing page and update middleware (#54)"
```

---

### Task 8: StytchProvider 包装器

**Files:**
- Create: `src/components/providers/StytchProvider.tsx`
- Modify: `src/app/(dashboard)/dashboard/(auth)/layout.tsx`

- [ ] **Step 1: 创建 StytchProvider**

```typescript
// src/components/providers/StytchProvider.tsx
"use client";

import { StytchProvider as StytchProviderSDK } from "@stytch/nextjs";
import { createStytchUIClient } from "@stytch/nextjs/ui";

const stytchClient = createStytchUIClient(
  process.env.NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN || ""
);

export function StytchProvider({ children }: { children: React.ReactNode }) {
  return (
    <StytchProviderSDK stytch={stytchClient}>
      {children}
    </StytchProviderSDK>
  );
}
```

- [ ] **Step 2: 在 auth layout 中添加 StytchProvider**

修改 `src/app/(dashboard)/dashboard/(auth)/layout.tsx`：

```typescript
import { StytchProvider } from "@/components/providers/StytchProvider";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <StytchProvider>{children}</StytchProvider>;
}
```

- [ ] **Step 3: 运行类型检查**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/providers/StytchProvider.tsx src/app/\(dashboard\)/dashboard/\(auth\)/layout.tsx
git commit -m "feat: add StytchProvider to auth layout (#54)"
```

---

### Task 9: 登录页面集成 Stytch Pre-built UI

**Files:**
- Modify: `src/app/(dashboard)/dashboard/(auth)/login/page.tsx`

- [ ] **Step 1: 在登录页面添加 StytchLogin 组件**

修改 `src/app/(dashboard)/dashboard/(auth)/login/page.tsx`，在 `LoginForm` 组件中添加 Stytch UI：

在 `import` 区域添加：
```typescript
import { StytchLogin } from "@stytch/nextjs/ui";
import { Products, OAuthProviders } from "@stytch/vanilla-js";
```

在 `LoginForm` 组件中，在 `<form>` 标签之前添加 Stytch 组件和分隔线：

```typescript
function LoginForm() {
  // ... 现有 state 和 handlers 保持不变 ...

  const stytchConfig = {
    products: [Products.emailMagicLinks, Products.oauth],
    emailMagicLinksOptions: {
      loginRedirectURL: `${window.location.origin}/dashboard/stytch-authenticate`,
      signupRedirectURL: `${window.location.origin}/dashboard/stytch-authenticate`,
    },
    oauthOptions: {
      providers: [{ type: OAuthProviders.Google }],
      loginRedirectURL: `${window.location.origin}/dashboard/stytch-authenticate`,
      signupRedirectURL: `${window.location.origin}/dashboard/stytch-authenticate`,
    },
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Sign in to Dashboard
          </CardTitle>
          <CardDescription className="text-center">
            Enter your email and password to access your account
          </CardDescription>
        </CardHeader>

        {/* Stytch Pre-built UI */}
        <CardContent>
          <StytchLogin config={stytchConfig} />
        </CardContent>

        {/* 分隔线 */}
        <div className="relative px-6 py-2">
          <div className="absolute inset-0 flex items-center px-6">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-muted-foreground">
              Or continue with password
            </span>
          </div>
        </div>

        {/* 现有密码登录表单 — 保持不变 */}
        <form onSubmit={handleSubmit}>
          {/* ... 现有 CardContent 和 CardFooter 代码不变 ... */}
        </form>
      </Card>
    </div>
  );
}
```

注意：`stytchConfig` 中 `window.location.origin` 需要在客户端渲染，确保此组件已经是 `"use client"`。

- [ ] **Step 2: 运行类型检查**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: 手动测试**

启动开发服务器：
```bash
npm run dev
```

验证：
1. 访问 `/dashboard/login` — 页面应显示 Stytch UI + 分隔线 + 密码表单
2. 密码登录仍能正常工作
3. Stytch UI 显示 Magic Link 输入框和 Google 按钮

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/dashboard/\(auth\)/login/page.tsx
git commit -m "feat: integrate Stytch Pre-built UI into login page (#54)"
```

---

### Task 10: Lint + 全量测试 + 最终验证

**Files:** 无新文件

- [ ] **Step 1: 运行 lint**

```bash
cd /Users/allan/workspace/plovr/plovr-grow-issue-54
npm run lint
```

修复所有 lint 错误。

- [ ] **Step 2: 运行类型检查**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: 运行全量测试**

```bash
npm test -- --run
```

修复任何回归测试失败。

- [ ] **Step 4: 最终 commit（如有修复）**

```bash
git add -A
git commit -m "fix: resolve lint and test issues for Stytch integration (#54)"
```
