# Order Item Structured Tables Design

**Issue**: #129 — refactor(order): extract Order.items JSON into structured OrderItem + OrderItemModifier tables
**Date**: 2026-04-12
**Approach**: 方案 A — 完整结构化 + 保留 JSON 快照（渐进迁移）

## Background

`Order.items` 当前是 `Json` 类型，存储 `OrderItemData[]` 非结构化 JSON。问题：

- 无法 SQL 查询行项目（如畅销菜品、菜品销售额）
- 读取依赖 `as unknown as` 强转，无运行时校验
- 无法做行项目级别的状态追踪
- 无法对单个行项目建立 `ExternalIdMapping` 关联

## Data Model

### OrderItem

| Field | Type | Description |
|-------|------|-------------|
| id | String @id | Entity ID |
| orderId | String | FK → Order |
| menuItemId | String | 下单时的菜品 ID |
| name | String | 快照：下单时菜品名 |
| unitPrice | Decimal(10,2) | 单价快照 |
| quantity | Int | 数量 |
| totalPrice | Decimal(10,2) | 行项目总价（含 modifiers） |
| notes | String? | 特殊要求 |
| imageUrl | String? | 菜品图片快照 |
| taxes | Json? | ItemTaxInfo[] 快照 |
| sortOrder | Int | 行项目排序 |
| deleted | Boolean | 软删除 |
| createdAt | DateTime | 创建时间 |
| updatedAt | DateTime | 更新时间 |

Indexes: `orderId`, `menuItemId`
Table name: `order_items`

### OrderItemModifier

| Field | Type | Description |
|-------|------|-------------|
| id | String @id | Entity ID |
| orderItemId | String | FK → OrderItem |
| modifierGroupId | String | Modifier group ID |
| modifierOptionId | String | Modifier option ID |
| groupName | String | 快照：group 名称 |
| name | String | 快照：modifier 名称 |
| price | Decimal(10,2) | 价格快照 |
| quantity | Int | 选择数量 |
| deleted | Boolean | 软删除 |
| createdAt | DateTime | 创建时间 |
| updatedAt | DateTime | 更新时间 |

Indexes: `orderItemId`
Table name: `order_item_modifiers`

### Design Decisions

- **taxes 保留 JSON**: 已计算的税费快照，不需要 SQL 查询，结构化无额外收益
- **不加 tenantId**: 通过 `orderId → Order.tenantId` 隔离，避免冗余
- **所有价格/名称为快照**: 下单时的值，不依赖当前菜单数据

## Write Path

### 双写策略

在 `orderRepository.create()` 中使用 Prisma nested create，在同一事务内同时写入 JSON 快照和结构化表：

```typescript
db.order.create({
  data: {
    ...data,
    items: input.items as unknown as Prisma.InputJsonValue, // 保留 JSON 快照
    orderItems: {
      create: items.map((item, index) => ({
        id: generateEntityId(),
        menuItemId: item.menuItemId,
        name: item.name,
        unitPrice: item.price,
        quantity: item.quantity,
        totalPrice: item.totalPrice,
        notes: item.specialInstructions ?? null,
        imageUrl: item.imageUrl ?? null,
        taxes: item.taxes ?? Prisma.JsonNull,
        sortOrder: index,
        modifiers: {
          create: item.selectedModifiers.map((mod) => ({
            id: generateEntityId(),
            modifierGroupId: mod.groupId,
            modifierOptionId: mod.modifierId,
            groupName: mod.groupName,
            name: mod.modifierName,
            price: mod.price,
            quantity: mod.quantity,
          })),
        },
      })),
    },
  },
});
```

### Affected Methods

- `orderRepository.create()` — 签名新增 `items: OrderItemData[]` 参数
- `createMerchantOrder` 和 `createGiftCardOrder` 两条路径都双写

### Not Changed (This PR)

- 所有读取路径继续读 `Order.items` JSON 快照
- 前端组件不改动
- Square integration 不改动

## New Repository Methods

```typescript
// 获取订单结构化行项目（含 modifiers）
async getOrderItems(orderId: string): Promise<OrderItemWithModifiers[]>

// 按菜品查询销售数据（报表功能铺路）
async getItemSalesByMenuItemId(
  tenantId: string,
  menuItemId: string,
  options?: { dateFrom?: Date; dateTo?: Date }
): Promise<{ totalQuantity: number; totalRevenue: Decimal }>
```

`getByIdWithMerchant` 增加 `include: { orderItems: { include: { modifiers: true } } }` 选项。

## Follow-up Issue

本 PR 完成后创建跟踪 Issue，覆盖未包含的迁移工作：

1. Dashboard 订单详情页 — 从 `order.orderItems` 读取替代 JSON 强转
2. Storefront 订单详情页 — 同上
3. `OrderDetailClient` 组件 — 移除 `JSON.parse` / `as unknown as` 强转
4. `OrderItemsList` 组件 — 改为接收结构化类型
5. Square integration — 从结构化表读取
6. 评估 `Order.items` JSON 标记为 deprecated
7. 历史订单数据回填脚本

## Testing

- 单元测试：`orderRepository.create()` 验证结构化数据写入
- 单元测试：新增查询方法返回正确结构
- 现有测试：确保 JSON 快照写入不受影响（回归）
