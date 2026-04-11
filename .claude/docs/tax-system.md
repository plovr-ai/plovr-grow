# 税费系统设计

## 数据模型

税费系统采用三层结构，支持：
- **Tenant 级别定义税种**（如 "Standard Tax", "Alcohol Tax"）
- **Merchant 级别设置具体税率**（同一税种在不同门店可有不同税率）
- **MenuItem 关联多个税种**（如酒类商品同时有标准税和酒税）

```
Tenant (1:N) → TaxConfig (税种定义)
                    ↓
Merchant (N:M) → MerchantTaxRate (门店具体税率)
                    ↓
MenuItem (N:M) → MenuItemTax (菜品关联的税种)
```

## 核心表结构

```prisma
// 税种配置 (Tenant 级别)
model TaxConfig {
  id              String   @id
  tenantId        String
  name            String   // "Standard Tax", "Alcohol Tax"
  description     String?
  roundingMethod  String   @default("half_up")  // half_up, half_even, always_round_up, always_round_down
  status          String   @default("active")
}

// 门店税率 (每个门店对每个税种的具体税率)
model MerchantTaxRate {
  id            String   @id
  merchantId    String
  taxConfigId   String
  rate          Decimal  @db.Decimal(5, 4)  // 0.0825 = 8.25%

  @@unique([merchantId, taxConfigId])
}

// 菜品税种关联 (多对多)
model MenuItemTax {
  id            String   @id
  menuItemId    String
  taxConfigId   String

  @@unique([menuItemId, taxConfigId])
}
```

## 税率舍入方法

| 方法 | 说明 | 示例 (0.125) |
|------|------|-------------|
| `half_up` | 四舍五入 (默认) | 0.13 |
| `half_even` | 银行家舍入 | 0.12 |
| `always_round_up` | 向上取整 | 0.13 |
| `always_round_down` | 向下取整 | 0.12 |

## 数据流

```
┌─────────────────────────────────────────────────────────────────────┐
│  菜单页面 (Menu Page)                                                │
│  └─ MenuService.getMenu(tenantId, merchantId)                       │
│      ├─ 获取 Tenant 级别菜单                                         │
│      ├─ 获取菜品关联的税种 IDs (MenuItemTax)                         │
│      ├─ 获取税种定义 (TaxConfig)                                     │
│      ├─ 获取门店税率 (MerchantTaxRate)                               │
│      └─ 返回菜品 + taxes[] 数组                                      │
├─────────────────────────────────────────────────────────────────────┤
│  购物车 (Cart Store)                                                 │
│  └─ 存储 CartItem.taxes: ItemTaxInfo[]                              │
├─────────────────────────────────────────────────────────────────────┤
│  价格计算 (usePricing Hook)                                          │
│  └─ 使用 item.taxes[] 计算每个商品的税额                             │
│      └─ 支持同一商品多个税种叠加计算                                  │
└─────────────────────────────────────────────────────────────────────┘
```

## 类型定义

```typescript
// 税种信息 (用于菜品和购物车)
interface ItemTaxInfo {
  taxConfigId: string;
  name: string;           // "Standard Tax"
  rate: number;           // 0.0825 (门店具体税率)
  roundingMethod: RoundingMethod;
}

// 菜品 ViewModel (包含税种信息)
interface MenuItemViewModel {
  id: string;
  name: string;
  price: number;
  taxes: ItemTaxInfo[];   // 支持多税种
  // ...
}

// 购物车商品 (包含税种信息)
interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  taxes?: ItemTaxInfo[];  // 用于价格计算
  // ...
}
```

## 使用示例

```typescript
// 1. 菜单服务返回带税种信息的菜品
const menu = await menuService.getMenu(tenantId, merchantId);
// menu.categories[0].menuItems[0].taxes = [
//   { taxConfigId: "tax-1", name: "Standard Tax", rate: 0.0825, roundingMethod: "half_up" }
// ]

// 2. 添加到购物车时传递 taxes
addItem({
  menuItemId: item.id,
  name: item.name,
  price: item.price,
  quantity: 1,
  taxes: item.taxes,  // 传递税种信息
});

// 3. 价格计算自动使用 taxes 数组
const { subtotal, taxAmount, totalAmount } = usePricing(cartItems, tip, fees);
// 支持：
// - 同一商品多个税种 (如酒类有标准税+酒税)
// - 不同商品不同税率
// - 免税商品 (taxes: [])
```

## 相关文件

| 文件 | 说明 |
|------|------|
| `src/repositories/tax-config.repository.ts` | 税种数据访问 |
| `src/services/menu/tax-config.service.ts` | 税种业务逻辑 |
| `src/services/menu/tax-config.types.ts` | 税种类型定义 |
| `src/services/menu/menu.service.ts` | 菜单服务 (集成税种) |
| `src/lib/pricing.ts` | 价格计算库 |
| `src/lib/tax.ts` | 税费舍入方法 |
| `src/hooks/usePricing.ts` | 价格计算 Hook |
| `src/stores/cart.store.ts` | 购物车状态管理 |
