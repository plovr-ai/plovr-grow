# 订单流程 E2E 集成测试设计

**Issue**: #184 — 为订单流程编写完整的 E2E 测试
**Date**: 2026-04-13
**Type**: Feature Request

## 目标

编写服务层集成测试，验证完整的在线订单链路：订单创建 → Square 推送 → Webhook 回调 → 状态流转。使用真实数据库 + Mock Square SDK。

## 测试文件

`src/services/order/__tests__/order-flow-e2e.integration.test.ts`

单文件，因为测试的是跨服务的完整链路而非单个服务。

## 测试场景

### 1. Happy Path: 在线订单 → Square 推送 → 履约完成

1. 通过 `orderService.createMerchantOrderAtomic()` 创建订单（含 items + modifiers + tax）
2. 验证 DB 中 Order、OrderItem、OrderItemModifier、Payment 记录正确
3. 触发 `order.paid` 事件 → 验证 `order-listener` 调用 Square `orders.create`
4. Mock Square 返回成功 → 验证 ExternalIdMapping 和 OrderFulfillment 记录创建
5. 模拟 Square webhook `order.updated`，逐步推进履约状态：
   - PROPOSED → confirmed
   - RESERVED → preparing
   - PREPARED → ready
   - COMPLETED → fulfilled
6. 每个状态转换后验证 DB 中 `fulfillmentStatus` 正确更新

### 2. 订单取消流程

1. 创建并支付订单
2. 调用 `fulfillmentService.cancelOrder()` 或 dashboard 取消
3. 验证 Square `orders.update` 被调用（fulfillment state = CANCELED）
4. 模拟 Square webhook 返回 CANCELED
5. 验证内部 `fulfillmentStatus` = canceled，`status` = canceled

### 3. 防护机制验证

- **Stale webhook guard**: 发送低版本号的 webhook → 验证被忽略，DB 状态不变
- **Loop prevention**: 事件 `source=square_webhook` → 验证 order-listener 不触发二次推送
- **Fulfillment 单调性**: 尝试从 `preparing` 回退到 `confirmed` → 验证被拒绝

### 4. Square 推送失败 → 重试记录

1. Mock Square API 抛出异常
2. 验证 `IntegrationSyncRecord` 创建，status = FAILED
3. 验证订单本身状态不受影响（仍为 completed）

## 技术方案

### 框架配置
- Vitest + `vitest.config.integration.ts`（node 环境，真实 DB）
- 文件串行执行（`fileParallelism: false` 已配置）

### 数据库
- 真实 PrismaClient，连接 TEST_DB_URL
- 每个 test 前 seed 必要数据（tenant, merchant, menu items, tax config, integration connection）
- 每个 test 后 cleanup（按 FK 依赖顺序删除）

### Mock 范围
- 仅 mock `@square/square` SDK
- 使用 `vi.mock()` + `vi.fn()` 控制返回值和异常
- 不 mock 内部服务（order, fulfillment, event listener 等全部真实执行）

### 事件验证
- spy on event emitter 验证事件触发
- 直接调用 order-listener 和 webhook service 验证下游行为
- 不依赖异步 setTimeout 事件传播（直接同步调用）

### Seed 数据
复用/参考现有 integration test 的 seed 模式：
- Tenant + Merchant
- MenuCategory + MenuItem + ModifierGroup + ModifierOption
- TaxConfig + Square tax mapping
- IntegrationConnection (Square, active)
- ExternalIdMapping (menu items → Square catalog IDs)

## 不包含

- 浏览器 UI 测试（无 Playwright/Cypress）
- Stripe PaymentIntent 验证（已有单独测试）
- Gift card 流程（无 Square 推送，已有 `order-transaction.integration.test.ts` 覆盖）
- Loyalty points 计算（独立功能，不属于核心订单链路）
