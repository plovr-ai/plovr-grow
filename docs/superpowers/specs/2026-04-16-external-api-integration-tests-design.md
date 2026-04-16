# External API Integration Tests Design

## 概述

为外部 phone order API 创建 route handler 层级的 integration test，验证从创建购物车到下单、查询、取消的完整业务流程。

## 测试文件

`src/app/api/external/v1/__tests__/external-order-flow.integration.test.ts`

## 测试数据（beforeAll 预置）

- 1 个 Tenant
- 1 个 Merchant（关联该 Tenant）
- 1 个 MenuCategory
- 3 个 MenuItem：
  - "Burger"（$12.99）
  - "Fries"（$4.99）
  - "Coke"（$2.49）
- 2 个 ModifierGroup + ModifierOption（如 size、extra topping）

## Mock 范围

- `validateExternalRequest` → 始终返回 `{ authenticated: true }`
- `@sentry/nextjs` → 空实现
- `@/lib/logger` → 空实现
- **不 mock** service 层和 repository 层 — 全部走真实数据库

## 测试场景

### 场景 1：完整电话下单流程（Happy Path）

1. `POST /carts` — 创建购物车，验证返回 201 + cart id
2. `POST /carts/{cartId}/items` — 添加 Burger（qty: 1），验证 201
3. `POST /carts/{cartId}/items` — 添加 Fries（qty: 2, 带 modifier: large size），验证 201
4. `GET /carts/{cartId}` — 查询购物车，验证包含 2 个商品、价格正确
5. `PATCH /carts/{cartId}/items/{burgerId}` — 修改 Burger 数量为 2，验证 200
6. `GET /carts/{cartId}` — 再次查询，验证 Burger 数量已更新、总价正确
7. `POST /carts/{cartId}/checkout` — 结账下单（pickup 模式），验证 201 + orderId
8. `GET /orders/{orderId}` — 查询订单，验证订单状态和商品信息

### 场景 2：购物车修改 — 删除商品再换新的

1. 创建购物车 + 添加 Burger
2. `DELETE /carts/{cartId}/items/{burgerId}` — 删除 Burger
3. `GET /carts/{cartId}` — 验证购物车为空（items = []）
4. 添加 Coke → 结账 → 验证订单只有 Coke

### 场景 3：下单后取消

1. 完成下单流程
2. `POST /orders/{orderId}/cancel` — 取消订单
3. `GET /orders/{orderId}` — 验证订单状态为 cancelled

### 场景 4：空购物车结账失败

1. 创建购物车（不添加商品）
2. `POST /carts/{cartId}/checkout` — 验证返回 422 + CART_EMPTY

### 场景 5：已提交购物车不可再操作

1. 完成下单流程（购物车状态变为 submitted）
2. `POST /carts/{cartId}/items` — 尝试添加商品，验证返回 422 + CART_NOT_ACTIVE
3. `DELETE /carts/{cartId}` — 尝试取消购物车，验证返回 422 + CART_NOT_ACTIVE

## 清理策略

`afterAll` 按 FK 依赖顺序删除：
CartItemModifier → CartItem → Cart → OrderItem → Order → MenuItem → MenuCategory → Merchant → Tenant

## 辅助函数

提供 `createRequest(url, options?)` 和 `createRouteContext(params)` 工具函数，封装 `NextRequest` 构造和 route params 传递。
