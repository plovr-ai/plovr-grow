# Cart API 设计文档

**Issue**: #252 — 增加购物车的 API
**日期**: 2026-04-15
**类型**: Feature Request

## 背景

当前 Online Ordering 的购物车是纯前端实现（Zustand + localStorage），无法支持外部系统调用。电话点餐场景需要通过 External API（#223 基础设施）调用服务端购物车 API，实现购物车的创建、编辑和提交下单。

## 核心决策

| 决策 | 结论 |
|------|------|
| 使用场景 | 外部系统集成模式（纯 API，无 UI） |
| 购物车存储 | 服务端持久化（数据库表） |
| 生命周期 | 不自动过期，显式提交或取消 |
| 支付 | 本次不涉及，后续再加 |
| 认证 | 使用 #223 的占位认证（`validateExternalRequest()`） |
| 架构方案 | 独立 Cart Service + Cart 数据库表（方案 A） |

## 数据模型

### 新增 3 张表

**`carts`** — 购物车头表（只存菜品相关，不存客户信息）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (cuid) | 主键 |
| tenantId | String | 租户隔离 |
| merchantId | String | 门店 |
| status | String | `active` / `submitted` / `cancelled` |
| salesChannel | String | `phone_order`（可扩展） |
| notes | String? | 购物车备注 |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**`cart_items`** — 购物车明细

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (cuid) | 主键 |
| cartId | String | FK → carts |
| menuItemId | String | FK → menu_items |
| name | String | 冗余存储菜名 |
| unitPrice | Decimal | 单价 |
| quantity | Int | 数量 |
| totalPrice | Decimal | 小计（含 modifier） |
| specialInstructions | String? | 特殊要求 |
| imageUrl | String? | 图片 |
| sortOrder | Int | 排序 |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**`cart_item_modifiers`** — 购物车 modifier

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (cuid) | 主键 |
| cartItemId | String | FK → cart_items |
| modifierGroupId | String | |
| modifierOptionId | String | |
| groupName | String | 冗余存储 |
| name | String | 冗余存储 |
| price | Decimal | |
| quantity | Int | |

结构与现有 `orders` / `order_items` / `order_item_modifiers` 完全对称。

## API 端点

所有端点挂在 `/api/external/v1/` 下，使用 `validateExternalRequest()` 占位认证。

### Cart CRUD

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/carts` | 创建购物车（tenantId, merchantId, salesChannel） |
| GET | `/carts/{cartId}` | 获取购物车详情（含 items + modifiers） |
| DELETE | `/carts/{cartId}` | 取消购物车（标记 `cancelled`） |

### Cart Items

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/carts/{cartId}/items` | 添加菜品 |
| PATCH | `/carts/{cartId}/items/{itemId}` | 修改菜品（quantity, modifiers, specialInstructions） |
| DELETE | `/carts/{cartId}/items/{itemId}` | 删除菜品 |

### 提交下单

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/carts/{cartId}/checkout` | 提交购物车为订单 |

**checkout 请求体**：

```typescript
{
  customerFirstName: string;
  customerLastName: string;
  customerPhone: string;
  customerEmail?: string;
  orderMode: "pickup" | "delivery" | "dine_in";
  deliveryAddress?: DeliveryAddress;  // delivery 时必填
  tipAmount?: number;
  notes?: string;                     // 订单备注
}
```

**checkout 内部逻辑**：

1. 验证 cart 状态为 `active` 且有 items
2. 将 cart items 转换为 `OrderItemData[]`
3. 调用 `orderService.createMerchantOrderAtomic()`，salesChannel 设为 `phone_order`
4. 将 cart 状态标记为 `submitted`
5. 返回 `{ orderId, orderNumber }`

## 服务层架构

### 新增文件

```
src/services/cart/
  ├── index.ts           # 导出 cartService 单例
  ├── cart.service.ts     # CartService 类
  └── cart.types.ts       # 输入/输出类型定义

src/repositories/
  └── cart.repository.ts  # CartRepository 类
```

### CartService 方法签名

```typescript
class CartService {
  // Cart CRUD
  createCart(tenantId: string, merchantId: string, input: CreateCartInput): Promise<Cart>
  getCart(tenantId: string, cartId: string): Promise<CartWithItems>
  cancelCart(tenantId: string, cartId: string): Promise<void>

  // Cart Items
  addItem(tenantId: string, cartId: string, input: AddCartItemInput): Promise<CartItem>
  updateItem(tenantId: string, cartId: string, itemId: string, input: UpdateCartItemInput): Promise<CartItem>
  removeItem(tenantId: string, cartId: string, itemId: string): Promise<void>

  // Checkout
  checkout(tenantId: string, cartId: string, input: CheckoutInput): Promise<CheckoutResult>
}
```

所有方法第一个参数为 `tenantId`，符合项目约定。

### CartRepository

封装所有数据库操作：
- `create()` / `findById()` / `updateStatus()` — cart 表操作
- `addItem()` / `updateItem()` / `removeItem()` — cart_items + cart_item_modifiers 操作
- `findByIdWithItems()` — 联查 cart + items + modifiers

### checkout 数据转换

`CartService.checkout()` 将 cart items 映射为 `OrderItemData[]`，调用 `orderService.createMerchantOrderAtomic()`。不重复实现订单创建逻辑。

### SalesChannel 扩展

在 `src/types/index.ts` 中给 `SalesChannel` 类型添加 `"phone_order"`。

## 验证与错误处理

### Zod Schema 验证

每个 API 端点用 Zod schema 验证请求体：

- **createCartSchema** — 验证 salesChannel 值
- **addCartItemSchema** — 验证 menuItemId 非空、quantity > 0、modifiers 结构
- **updateCartItemSchema** — 验证 quantity > 0（可选）、modifiers（可选）
- **checkoutSchema** — 验证客户信息必填、orderMode 合法、delivery 时 deliveryAddress 必填

### 业务错误码

在 `error-codes.ts` 中新增：

| 错误码 | 场景 |
|--------|------|
| `CART_NOT_FOUND` | cartId 不存在或不属于该 tenant |
| `CART_NOT_ACTIVE` | 操作已 submitted/cancelled 的 cart |
| `CART_EMPTY` | checkout 时 cart 无 items |
| `CART_ITEM_NOT_FOUND` | itemId 不存在 |
| `CART_MENU_ITEM_NOT_FOUND` | menuItemId 在菜单中不存在 |

所有错误通过 `AppError` 抛出，翻译文件 `shared/en.json` 同步更新。

### 菜品验证

`addItem` 时验证 menuItemId 存在于该 tenant 的菜单中（调用现有 `menuRepository`），并用数据库中的价格，防止价格篡改。

## 测试策略

### 单元测试

**`cart.service.test.ts`** — mock CartRepository + OrderService：

- 创建 cart：正常流程、验证 tenantId/merchantId 传递
- 添加 item：正常、menuItemId 不存在、cart 非 active 状态
- 修改 item：修改数量、修改 modifiers、itemId 不存在
- 删除 item：正常、itemId 不存在
- 取消 cart：正常、已 submitted 的 cart 不可取消
- checkout：正常流程验证 OrderService 被正确调用、cart 为空时报错、cart 非 active 报错

### 集成测试

**`cart.service.integration.test.ts`** — 使用真实数据库：

- **完整生命周期**：创建 cart → 添加 items → 修改 item → 删除 item → checkout → 验证 order 创建成功 + cart 状态变为 submitted
- **租户隔离**：tenant A 的 cart 无法被 tenant B 访问
- **状态约束**：submitted/cancelled 的 cart 拒绝所有编辑操作
- **菜品验证**：menuItemId 不存在时报错
- **数据清理**：测试后清理 cart/order 相关数据（注意 FK 依赖顺序）

参考现有集成测试模式的 setup/cleanup 结构。

### 不做的

- 不做 E2E 测试（纯 API，无 UI 交互）
