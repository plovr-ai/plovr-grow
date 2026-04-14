# External API Infrastructure Design

**Issue**: #223 — 增加对另一个服务开放的 API 基础设施
**Date**: 2026-04-14

## Background

当前所有 API 面向内部前端（dashboard 用 NextAuth session，storefront 用公开端点）。现需为外部服务（电话语音服务）开放 API，要求与现有 API 隔离并有独立鉴权机制。

本次 issue 只搭建基础设施，不实现具体业务 API（Menu、Cart、Order 留到后续 issue）。

## Scope

1. 外部 API 路由结构
2. 鉴权 middleware 框架（预留，暂不实现具体校验）
3. Health check 端点验证链路

## Design

### Route Structure

```
src/app/api/external/v1/
├── health/
│   └── route.ts          # GET — health check
```

后续 issue 在 `v1/` 下添加 `menu/`, `cart/`, `orders/` 等子目录。

### Authentication Middleware

新建 `src/lib/external-auth.ts`：

```typescript
import { NextRequest } from "next/server";

export type ExternalCaller = {
  authenticated: boolean;
  // 后续扩展：callerId, permissions, rateLimit 等
};

export async function validateExternalRequest(
  request: NextRequest
): Promise<ExternalCaller> {
  // TODO: 实现 API key 校验
  // 1. 从 request header 取 API key (Authorization: Bearer <key>)
  // 2. 查数据库校验 key 是否有效
  // 3. 返回调用方身份信息
  return { authenticated: true };
}
```

- API key 不绑定任何业务层级（不关联 tenant/merchant），纯做身份验证
- 每个外部 API 端点在 handler 开头调用 `validateExternalRequest`，校验不通过返回 401

### Health Check Endpoint

`GET /api/external/v1/health`

Response:
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2026-04-14T12:00:00.000Z"
  }
}
```

### Response Format

沿用项目现有约定：

```typescript
// 成功
{ success: true, data: { ... } }

// 失败
{ success: false, error: { code: "ERROR_CODE" } }
```

## Out of Scope

- 具体业务 API（Menu、Cart、Order）
- API key 数据库模型和校验逻辑
- Rate limiting
- API 文档（Swagger/OpenAPI）
