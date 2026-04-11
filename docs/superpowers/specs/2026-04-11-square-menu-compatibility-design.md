# Square Menu 模型兼容性设计

**Issue**: #89 — 检查 Square 的 Menu 模型和现有系统的兼容性
**关联**: `docs/superpowers/specs/2026-04-08-square-integration-design.md`(Phase 1 Square 集成总设计)
**Date**: 2026-04-11

## 目的

对 Square Catalog 的 Menu 模型与 Plovr 现有 menu/tax 数据模型做逐项兼容性评估，针对不兼容项给出 Phase 1 可落地的处置方案。本文档是 Square 集成 Phase 1 的补充规范——它**不替换** `2026-04-08-square-integration-design.md`，而是细化其中"Catalog Mapping Logic"一节，特别是 Variation / ModifierList / Tax 的映射规则。

原始集成设计将 Square Variation 笼统塞入 `modifiers` JSON、未处理 inclusive tax、未定义 Variation 的结构化映射路径。本文档补齐这三处。

## 现状快照

### Plovr 数据模型

| 实体 | 字段要点 | 存储 |
|---|---|---|
| `MenuItem` | 单 `price`、单 `imageUrl`、`modifiers` `Json?`、`nutrition` `Json?`、`tags` `Json?` | 表 + JSON |
| `MenuCategory` | 扁平、仅 `sortOrder`、无父子 | 表 |
| `MenuCategoryItem` | item ↔ category 多对多 | 表 |
| `ModifierGroup` / `ModifierOption` | **应用层类型**(`ModifierGroupInput` / `ModifierInput`)嵌入 `MenuItem.modifiers` JSON,**无独立表** | JSON |
| `TaxConfig` | `name`、`roundingMethod`、`status` —— **无 `inclusionType`、无 `percentage`** | 表 |
| `MerchantTaxRate` | `merchantId + taxConfigId` 组合承载实际税率 | 表 |
| `MenuItemTax` | item ↔ taxConfig 关联 | 表 |

`ModifierGroupInput` / `ModifierInput` 结构已覆盖 `type: single|multiple`、`required`、`allowQuantity`、`maxQuantityPerModifier`、`isDefault`、`isAvailable`——与 Square `CatalogModifierList` 字段对应完备。每个 modifier option 的 `price` 语义为 **delta**(在 base price 上的加价)。

### 价格与税费计算

`src/lib/pricing.ts` 的 `calculateOrderPricing` 是前后端共享的核心计算函数:
- 输入: `PricingItem[]`(含 `unitPrice`, `quantity`, `taxes: ItemTaxConfig[]`)
- 当前税费逻辑纯 additive: `tax = unitPrice × qty × rate`,累加到 `totalAmount`
- 被 checkout page、order service、catering order service、invoice、`usePricing` hook 共享

## Square Catalog Menu 模型对照

| Square 对象 | 核心字段 | Plovr 对应 |
|---|---|---|
| `CatalogItem` | `name`、`description`、`categories[]`、`tax_ids[]`、`modifier_list_info[]`、`variations[]`、`product_type`、`image_ids[]`、`item_options[]` | `MenuItem` |
| `CatalogItemVariation` | `name`、`sku`、`price_money`、`pricing_type`、`ordinal`、`item_option_values[]`、`location_overrides[]`、`track_inventory`、`stockable`、`image_ids[]` | **无直接对应** → 映射为 modifier group(决策 A) |
| `CatalogModifierList` | `name`、`selection_type`、`min/max_selected_modifiers`、`modifiers[]` | `ModifierGroupInput` JSON |
| `CatalogModifier` | `name`、`price_money`、`ordinal`、`modifier_list_id` | `ModifierInput` JSON |
| `CatalogCategory` | `name`、`parent_category`、`image_ids`、`category_type` | `MenuCategory`(扁平) |
| `CatalogTax` | `name`、`percentage`、`calculation_phase`、`inclusion_type`、`enabled` | `TaxConfig` + `MerchantTaxRate` |
| `CatalogImage` | `url`、`caption` | 解析取首图 url |
| `CatalogItemOption` / `CatalogItemOptionValue` | `name`、`display_name`、values(Size=[S,M,L]) | 作为 modifier group name 来源 |
| `CatalogDiscount` / `CatalogPricingRule` / `CatalogProductSet` / `CatalogTimePeriod` / `CatalogQuickAmounts` / `CatalogMeasurementUnit` / `CatalogSubscriptionPlan` | 高级定价与规则引擎 | Phase 1 **全部跳过** |

## 核心决策

### 决策 A — Variation 映射为 ModifierGroup

**不引入 `MenuItemVariation` 表**。Square Item 的 variation 列表映射为 Plovr `MenuItem.modifiers` JSON 里的一个必选单选 group。

#### 映射规则

**单 variation item**: 1:1 映射到一个 `MenuItem`
- `MenuItem.price = variation.price_money.amount / 100`
- 若 item 还有 `modifier_list_info`,按常规流程加入 `modifiers` JSON
- `ExternalIdMapping`: `externalType="ITEM"`, `internalType="MenuItem"`; 同时为该唯一 variation 写一条 `externalType="ITEM_VARIATION"` → `internalType="MenuItem"`,便于 Phase 2 订单回写时反查

**多 variation item**(N ≥ 2): 1 个 MenuItem + 1 个注入 modifier group
- `MenuItem.price = min(variations.price)`(作为 base price)
- 在 `modifiers` JSON 数组**开头**注入一个必选单选 group:
  ```json
  {
    "id": "<generated-uuid>",
    "name": "<option-group-name>",
    "type": "single",
    "required": true,
    "allowQuantity": false,
    "modifiers": [
      { "id": "<uuid-v1>", "name": "Small",  "price": 0.00, "isDefault": true,  "isAvailable": true },
      { "id": "<uuid-v2>", "name": "Medium", "price": 1.00, "isDefault": false, "isAvailable": true },
      { "id": "<uuid-v3>", "name": "Large",  "price": 2.00, "isDefault": false, "isAvailable": true }
    ]
  }
  ```
- **option group name 选择顺序**:
  1. 若 variation 通过 `item_option_values[]` 关联到单一 `CatalogItemOption`, 取 `item_option.name` (例 "Size")
  2. 若关联到多个 item_option (Size × Color 组合), 取 **拼接名** (`"Size / Color"`)
  3. 否则默认 `"Options"`
- **option.name 选择顺序**:
  1. 若有 `item_option_values`, 拼接 value.name (`"Small / Red"`)
  2. 否则取 `variation.name`
- **option.price (delta) 计算**: `variation.price - base_price`, 精度 2 位小数
- **isDefault**: 价格等于 `base_price` 的第一个 variation 置 `true`, 其余 `false`
- **ordinal**: 按 Square `variation.ordinal` 升序排列; 相同 ordinal 回退到数组顺序
- **多 item_option 笛卡尔积**: Square 中 Size × Color 会生成 N×M 个 variation,上述逻辑直接展开平铺成一个单选 group 的多个 option,不拆成两个 group(避免价格矩阵语义问题)。

#### ExternalIdMapping 扩展

每个 variation 写一条映射,便于 Phase 2 订单回写:

```
externalSource = "SQUARE"
externalType   = "ITEM_VARIATION"
externalId     = <square variation id>
internalType   = "ModifierOption"
internalId     = "<MenuItem.id>:<group.id>:<option.id>"   // 冒号分隔三段定位
```

单 variation item 的映射 `internalType = "MenuItem"`, `internalId = <MenuItem.id>`。

#### 丢失信息(记入同步日志 + 计数)

- `variation.sku` / `upc`
- `variation.image_ids`(variation 级图片)
- `variation.stockable` / `track_inventory` / `inventory_alert_*`
- `variation.location_overrides`(多店价格差异)
- `variation.pricing_type = VARIABLE_PRICING`(按重量/体积定价): **跳过整条 variation**,若导致 item 无可用 variation 则整个 item 跳过
- `variation.measurement_unit_id`
- `variation.service_duration` / `available_for_booking`(预约业务字段)

#### 边界场景

- **item.variations 为空**: 跳过 item,日志记录 warning
- **item.product_type 非 `REGULAR` / `FOOD_AND_BEV`**: 跳过 item (GIFT_CARD / APPOINTMENTS_SERVICE 等),计数
- **所有 variation 均为 VARIABLE_PRICING**: 跳过 item,计数
- **Square ModifierList 与注入的 Variation group 冲突**(极少见: 商家把 variation 选择也做成了 modifier list): 两者共存,注入 group 始终在 `modifiers` 数组开头

### 决策 B — Modifier 继续 JSON 存储(不抽独立表)

Phase 1 保持 `MenuItem.modifiers Json?` 不变。`ModifierGroupInput` / `ModifierInput` 结构已覆盖 Square `CatalogModifierList` 所需字段,仅存储形式不同。

**Square → Plovr 映射**:

```
CatalogModifierList                Plovr ModifierGroupInput
──────────────────                 ────────────────────────
name                          →    name
selection_type = "SINGLE"     →    type: "single"
selection_type = "MULTIPLE"   →    type: "multiple"
min_selected_modifiers > 0    →    required: true
max_selected_modifiers        →    (存入 group 扩展字段,或在 type=multiple 时隐含为无上限)
modifiers[]                   →    modifiers: ModifierInput[]
modifier.name                 →    option.name
modifier.price_money          →    option.price  (delta; base_modifier = 0)
modifier.ordinal              →    排序依据
```

**接受代价**:
- 同一 Square `ModifierList` 绑定在 N 个 Item 上 → 在 N 个 `MenuItem.modifiers` JSON 中各存一份副本(约 N×KB 冗余,可接受)
- Square 端修改 ModifierList 后,必须 full sync 才能同步到所有关联 item
- **ExternalIdMapping** 仍为 `CatalogModifierList` 写一条映射(`externalType="MODIFIER_LIST"`, `internalType="ModifierGroupTemplate"`, `internalId="<modifier_list_id>"`),用于回写方向去重

**未来迁移路径**(不在 Phase 1 scope): 若 Plovr 将 modifier 抽成独立表,`ExternalIdMapping` 的 internalType 可切换为 `"ModifierGroup"`,映射规则向前兼容。

### 决策 C — TaxConfig 增加 `inclusionType` + 同步改造 pricing

#### Schema 改动

```prisma
model TaxConfig {
  // ... 既有字段
  inclusionType String @default("additive")  // "additive" | "inclusive"
  // ...
}
```

`src/services/menu/tax-config.types.ts` 新增:

```typescript
export type TaxInclusionType = "additive" | "inclusive";
```

#### Square → Plovr 映射

| Square `CatalogTax.inclusion_type` | Plovr `TaxConfig.inclusionType` |
|---|---|
| `ADDITIVE` | `"additive"` |
| `INCLUSIVE` | `"inclusive"` |

Square `calculation_phase`(`TAX_SUBTOTAL_PHASE` / `TAX_TOTAL_PHASE`) Phase 1 **不区分**——Plovr 只支持 subtotal phase;若为 `TOTAL_PHASE` 同步时降级为 subtotal 处理并日志 warning。

#### pricing.ts 改造

`ItemTaxConfig` 扩展:

```typescript
export interface ItemTaxConfig {
  rate: number;
  roundingMethod: RoundingMethod;
  inclusionType: TaxInclusionType;  // 新增,默认 "additive" 以兼容既有调用
}
```

`calculateOrderPricing` 的税费计算分支:

```typescript
for (const item of items) {
  const lineTotal = item.unitPrice * item.quantity;  // 商品行原始金额
  for (const tax of item.taxes || []) {
    if (tax.rate <= 0) continue;
    let rawTax: number;
    if (tax.inclusionType === "inclusive") {
      // 价内税: unitPrice 已含税, 反推税额
      // taxableBase = lineTotal / (1 + rate); tax = lineTotal - taxableBase
      const taxableBase = lineTotal / (1 + tax.rate);
      rawTax = lineTotal - taxableBase;
    } else {
      // 价外税(当前行为)
      rawTax = lineTotal * tax.rate;
    }
    totalTaxAmount += applyRounding(rawTax, tax.roundingMethod);
  }
}
```

**Total 的计算分支**:
- **additive only**: `total = subtotal + tax + fees + tip`(既有行为)
- **含任一 inclusive tax**: inclusive 税已经包含在 subtotal 中,**不再累加**到 total。实现策略: pricing 返回新字段 `taxIncludedInSubtotal: number`, `calculateOrderPricing` 在累加 total 时只加 additive 部分的 tax。

`PricingResult` 扩展:

```typescript
export interface PricingResult {
  subtotal: number;
  taxAmount: number;              // 仍记录实际税额总和(additive + inclusive)
  taxAmountAdditive: number;      // 新增: 仅 additive 部分,用于 total 累加
  taxAmountInclusive: number;     // 新增: 仅 inclusive 部分,UI 标 "(included)"
  feesAmount: number;
  feesBreakdown: FeeBreakdownItem[];
  tipAmount: number;
  totalAmount: number;            // = subtotal + taxAmountAdditive + fees + tip
}
```

**混合场景范围说明**:
- **跨 item 混合**(订单中 item A 挂 additive、item B 挂 inclusive): **支持**,两种税分别累加,`taxAmountAdditive` / `taxAmountInclusive` 分别记录,`totalAmount` 只加 additive 部分
- **同 item 混挂**(同一 item 同时挂 additive 和 inclusive 税): Phase 1 **不支持**——同步时若检测到 Square item 的 `tax_ids[]` 同时包含两种类型的 tax,写 warning 并仅保留**第一条**(按 `tax_ids` 数组顺序),计数记录。理论上按 Square 标准行为应分别独立计算,Phase 1 主动收窄以简化实现

#### 下游消费方改造

| 文件 | 改动 |
|---|---|
| `src/lib/pricing.ts` | 核心逻辑 + 类型扩展 |
| `src/lib/__tests__/pricing.test.ts` | 新增 inclusive 单元测试:单税、多税、0% 税率、舍入边界 |
| `src/services/menu/tax-config.types.ts` | 导出 `TaxInclusionType` |
| `src/services/menu/tax-config.service.ts` | `getById` / `list` 返回 `inclusionType` |
| `src/repositories/tax-config.repository.ts` | 读写 `inclusionType` |
| `src/services/order/order.service.ts` | 读税配置时传入 `inclusionType`;落库 `Order.taxAmount` 语义保持(实际税额总和) |
| `src/services/catering/catering-order.service.ts` | 同上 |
| `src/app/(storefront)/r/[merchantSlug]/checkout/page.tsx` | 传 `inclusionType` 到 pricing 调用 |
| `src/app/(storefront)/components/checkout/PriceSummary.tsx`(及其测试) | inclusive 部分展示为 `Tax (included): $X.XX` 不计入 total 行;additive 部分维持当前展示 |
| `src/hooks/usePricing*` 及 `src/hooks/__tests__/usePricing.test.ts` | 传递 `inclusionType` |
| `src/services/invoice/invoice.types.ts` | 如涉及税行展示同步标记 |
| `src/components/orders/DashboardOrderDetailClient.tsx` 等订单详情 | 展示历史订单 tax 行时保持既有字段语义(历史订单无需回溯) |

#### 迁移与兼容

- Prisma migration: `ALTER TABLE tax_configs ADD COLUMN inclusion_type VARCHAR DEFAULT 'additive'`
- 既有 `TaxConfig` 全部默认 `additive`,既有计算结果不变
- 既有订单 `Order.taxAmount` / `Order.subtotal` 不回写(历史数据按 additive 语义存在即可)
- `ItemTaxConfig.inclusionType` 在 TypeScript 层用默认值 `"additive"` 兜底所有未更新的调用点

## ExternalIdMapping 扩展

`ExternalIdMapping` 新增字段用于增量同步与变更检测:

```prisma
model ExternalIdMapping {
  // ... 既有字段
  externalVersion BigInt?  @map("external_version")  // Square CatalogObject.version
  // ...
}
```

**用途**: Square 的每个 `CatalogObject` 都带 `version`(乐观锁)。增量同步时比较 `externalVersion` 与 Square 返回值,相等则跳过处理。Phase 1 full sync 也写入该字段,为 Phase 2 delta sync 铺路。

**支持的 externalType 枚举**(Phase 1):

| externalType | internalType | internalId 形式 |
|---|---|---|
| `ITEM` | `MenuItem` | `<menu_item_id>` |
| `ITEM_VARIATION` | `MenuItem`(单 variation) 或 `ModifierOption`(多 variation) | `<menu_item_id>` 或 `<menu_item_id>:<group_id>:<option_id>` |
| `MODIFIER_LIST` | `ModifierGroupTemplate` | `<square_modifier_list_id>`(占位,为 Phase 2 抽表预留) |
| `CATEGORY` | `MenuCategory` | `<menu_category_id>` |
| `TAX` | `TaxConfig` | `<tax_config_id>` |
| `IMAGE` | — | 不持久化,同步时直接解析 url(决策 D 下述) |

## 其余不兼容项的处置

| Square 特性 | 决策 | 实现要点 |
|---|---|---|
| `CatalogCategory.parent_category`(层级) | 扁平化 | 只同步叶子 category;若 Square 端只有父分类无叶子,则同步父分类;父子链丢弃但记录在同步日志 |
| `CatalogImage` 独立对象 / `image_ids[]` | 取首图 | 同步时一次性拉取所有 Image 对象建立 `image_id → url` map;item 取 `image_ids[0]` 对应 url 写入 `MenuItem.imageUrl`;其余丢弃 + 计数 |
| `present_at_location_ids` / `absent_at_location_ids` | 忽略 | Phase 1 只支持 company 级菜单,location 级可见性全部忽略;若 item `present_at_all_locations = false` 且无 present list,跳过 item + 计数 |
| `location_overrides`(variation 级别) | 取全局价 + 日志 | 取 `variation.price_money` 作为全局价;`location_overrides` 列表中的每个条目写一条 sync log(差价幅度、location id),便于 Phase 2 覆盖表落地 |
| `product_type` 非 REGULAR/F&B | 跳过 + 计数 | GIFT_CARD、APPOINTMENTS_SERVICE、DONATION 等跳过 |
| `CatalogDiscount` / `CatalogPricingRule` / `CatalogProductSet` / `CatalogTimePeriod` / `CatalogQuickAmountsSettings` / `CatalogMeasurementUnit` / `CatalogSubscriptionPlan` | 整体跳过 | 同步时不拉取或拉取后丢弃,按类型计数写 IntegrationSyncRecord |
| `description_html` / `description_plaintext` | 取 plaintext | `MenuItem.description = description_plaintext ?? description` |
| `abbreviation` / `label_color` / `sort_name` | 丢弃 | 不映射 |
| `channels` / `ecom_*` / `food_and_beverage_details` | 丢弃 | 不映射 |
| `is_archived` | status | `MenuItem.status = "archived"`, `MenuCategory.status = "archived"` |
| `is_deleted` | deleted flag | `MenuItem.deleted = true` 等 |
| `CalculationPhase = TAX_TOTAL_PHASE` | 降级 | 当 subtotal phase 处理 + warning |

## IntegrationSyncRecord 扩展(仅在原设计上加计数字段)

`src/services/integration/integration.types.ts` 的 sync result 结构增加计数上报:

```typescript
interface CatalogSyncStats {
  itemsCreated: number;
  itemsUpdated: number;
  itemsSkipped: number;          // 含 VARIABLE_PRICING / 非支持 product_type 等
  variationsAsOptions: number;   // 决策 A 注入 group 的 item 数
  modifierListsFlattened: number;
  categoriesFlattened: number;   // parent_category 被扁平化的数量
  locationOverridesDropped: number;
  imagesDropped: number;
  taxesInclusive: number;
  taxesAdditive: number;
  discountsSkipped: number;
  pricingRulesSkipped: number;
  warnings: string[];            // 前 100 条详细 warning,超出截断
}
```

存入 `IntegrationSyncRecord.stats Json?`(需在 `IntegrationSyncRecord` 增加 `stats` 字段)或序列化进 `errorMessage`——建议加字段,Phase 2 delta sync 也会用到。

## 测试计划

### 单元测试

1. **`src/lib/__tests__/pricing.test.ts`** 新增用例:
   - 纯 additive tax(回归)
   - 纯 inclusive tax(单税率 / 0% / 舍入边界)
   - 多 item 混合 additive / inclusive
   - `taxAmountAdditive` / `taxAmountInclusive` / `totalAmount` 分项正确性

2. **`src/services/square/__tests__/square-catalog.test.ts`** 新增用例(针对映射函数):
   - 单 variation → 1:1 MenuItem
   - 多 variation 无 item_option → 注入 `"Options"` group,base = min price,delta 正确
   - 多 variation 有单个 item_option(`"Size"`)→ group name = `"Size"`,option name = option value name
   - 多 variation 有多个 item_option(Size × Color)→ group name 拼接,option name 拼接
   - variation `VARIABLE_PRICING` → 跳过 variation,计数 +1
   - item.variations 为空 → 跳过 item
   - item.product_type = `GIFT_CARD` → 跳过 + 计数
   - `location_overrides` 存在 → 取全局价 + warning 日志
   - `image_ids` 多张 → 只取首张
   - `CatalogTax.inclusion_type = INCLUSIVE` → `TaxConfig.inclusionType = "inclusive"`
   - `calculation_phase = TAX_TOTAL_PHASE` → 降级 + warning
   - `ModifierList.selection_type = SINGLE/MULTIPLE` / `min_selected_modifiers` → `ModifierGroupInput.type` / `required`
   - `ExternalIdMapping` 为 variation 写入正确的 `internalId` 格式

3. **`src/repositories/__tests__/tax-config.repository.test.ts`** 更新覆盖 `inclusionType` 读写

### 集成测试

- `src/services/square/__tests__/square-catalog.integration.test.ts`(新增或扩展): 构造 mock 的完整 Square catalog payload(包含 item + 多 variation + item_option + modifier list + inclusive tax),调用 `syncFull`,断言:
  - `MenuItem` / `MenuCategory` / `TaxConfig` / `ExternalIdMapping` 写入正确
  - `IntegrationSyncRecord.stats` 计数与实际处理匹配
  - 重跑幂等(第二次 syncFull 不产生重复数据)

### 回归测试

- `src/lib/__tests__/pricing.test.ts` 所有既有用例保持通过
- `src/hooks/__tests__/usePricing.test.ts` 所有既有用例保持通过(默认 additive 分支不变)
- checkout page / PriceSummary / order detail 既有快照不破

## 需要改动的文件清单(供 plan 参考)

**Schema 迁移**
- `prisma/schema.prisma`: `TaxConfig.inclusionType`、`ExternalIdMapping.externalVersion`、`IntegrationSyncRecord.stats`
- 一次 Prisma migration

**pricing / tax**
- `src/lib/pricing.ts`
- `src/lib/__tests__/pricing.test.ts`
- `src/services/menu/tax-config.types.ts`
- `src/services/menu/tax-config.service.ts`
- `src/repositories/tax-config.repository.ts`
- `src/repositories/__tests__/tax-config.repository.test.ts`

**pricing 调用方**
- `src/services/order/order.service.ts`
- `src/services/catering/catering-order.service.ts`
- `src/hooks/usePricing*`(及 `src/hooks/__tests__/usePricing.test.ts`)
- `src/app/(storefront)/r/[merchantSlug]/checkout/page.tsx`
- `src/app/(storefront)/components/checkout/PriceSummary.tsx`(及其测试)
- 其他通过 grep `ItemTaxConfig` / `calculateOrderPricing` 找到的调用点

**Square catalog 映射**
- `src/services/square/square-catalog.service.ts`(新增或扩展映射函数)
- `src/services/square/__tests__/square-catalog.test.ts`
- `src/services/square/__tests__/square-catalog.integration.test.ts`(若尚无则新增)
- `src/services/square/square.types.ts`(内部映射中间类型)

**integration 框架**
- `src/services/integration/integration.types.ts`: `CatalogSyncStats` 类型
- `src/services/integration/integration.service.ts`: 扩展 `recordSync` 接受 stats
- `src/repositories/__tests__/integration.repository.test.ts`

## Out of Scope

- Variation 独立表(`MenuItemVariation`)—— 未来工程,可能推进时本设计的"modifier group 注入"策略需迁移
- Modifier 抽独立表 —— 未来工程
- Order push 回写(Plovr → Square)—— Phase 2;本设计的 `ExternalIdMapping` 结构已为其预留
- Delta / cursor-based 增量同步 —— Phase 2;`externalVersion` 字段已预留
- Square Webhook —— 独立 spec (`2026-04-09-square-webhook-design.md`)
- 多店菜单覆盖表 —— 未规划
- 库存 / SKU / 打印条码 —— 未规划
- CatalogDiscount / PricingRule 等高级定价引擎 —— 未规划
- 货币换算(Square 支持多货币,Plovr 默认 USD)—— 假定同步的 Square 账户货币与 merchant.currency 一致,不一致时跳过并 warning
