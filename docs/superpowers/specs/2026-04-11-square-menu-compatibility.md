# Square Menu Compatibility & Gap Analysis

**Issue**: #89 — 检查 Square 的 Menu 模型和现有系统的兼容性
**Date**: 2026-04-11
**Scope**: Square Catalog 中所有 Menu 相关对象 × plovr-grow 现有 Menu schema 的**字段级**兼容性分析，并为每个 gap 给出落地方案。本 spec 是 `2026-04-08-square-integration-design.md` 的补充 —— 后者只给了高层 1:1 映射表，本 spec 做细粒度 gap + 设计。
**Out of scope**: Discount / PricingRule / ProductSet（显式跳过）。

---

## 1. Catalog 对象清单与本期处理策略

| Square 对象 | 当前支持 | 本期目标 |
|---|---|---|
| `CATEGORY` / `CatalogObjectCategory` | 部分（仅 name + 单 category） | 补多 category、保留 metadata；父子层级降级存入 sourceMetadata |
| `ITEM` | 基础字段 | 补 pricingType、kitchenName、多 category、isArchived、dietary 等 → 新字段 + sourceMetadata |
| `ITEM_VARIATION` | 仅 name/price（被折叠成 "Size" modifier） | 保留现行折叠策略；但在 mapper 层保留 sku/upc/pricingType/measurementUnitId 等 metadata，并暴露给后续做 first-class variation 表时使用 |
| `MODIFIER_LIST` | selectionType + modifiers | 补 ordinal、min/max selected、hiddenFromCustomer、modifierType（TEXT vs LIST） |
| `MODIFIER` | name + price | 补 ordinal、onByDefault、hiddenOnline、kitchenName、imageId |
| `CatalogItemModifierListInfo` | 仅 enabled | 补 modifierOverrides、min/maxSelectedModifiers override、ordinal |
| `TAX` | name + percentage | 补 inclusionType、calculationPhase、appliesToCustomAmounts → 扩 `TaxConfig` |
| `ITEM_OPTION` / `ITEM_OPTION_VALUE` | ✗ 完全不支持 | 本期降级：把 itemOptions 展平成合成 modifier group；原始信息写入 sourceMetadata，future phase 做 first-class 表 |
| `MEASUREMENT_UNIT` | ✗ 完全不支持 | 新增 `MeasurementUnit` 表，variation 通过 measurementUnitId 引用 |
| `IMAGE` | ✗（只存单个 URL） | 本期：把 imageIds → URL 列表存 sourceMetadata.imageUrls，首张作为 `imageUrl`；first-class 表留 future |
| `QUICK_AMOUNTS_SETTINGS` | ✗ | 不适用（POS-only），忽略 |
| `CUSTOM_ATTRIBUTE_DEFINITION` | ✗ | 不适用，忽略 |
| `PRICING_RULE` / `DISCOUNT` / `PRODUCT_SET` | ✗ | 显式 out of scope |
| `SUBSCRIPTION_PLAN*` | ✗ | 不适用（另有订阅体系），忽略 |

---

## 2. 字段级兼容矩阵

### 2.1 CatalogCategory → MenuCategory

| Square 字段 | 现有 `MenuCategory` 字段 | 状态 | 方案 |
|---|---|---|---|
| `name` | `name` | ✓ 已支持 | — |
| `imageIds[]` | `imageUrl` | ⚠ 类型不匹配 | 取首张 image 的 URL（需 IMAGE 对象解引用），存 `imageUrl`；完整列表存 `sourceMetadata.imageUrls` |
| `categoryType` (`REGULAR_CATEGORY`/`MENU_CATEGORY`) | ✗ | gap | 存 `sourceMetadata.categoryType`；不影响现有逻辑 |
| `parentCategory` / `isTopLevel` / `rootCategory` / `pathToRoot` | ✗ | gap | 本期不做多层嵌套。存 `sourceMetadata.parentExternalId`，日志 warn；future 可加 `parentCategoryId` 自关联字段 |
| `channels[]` | ✗ | gap | 存 `sourceMetadata.channels` |
| `availabilityPeriodIds[]` | ✗ | gap | 不支持时段可见性；存 metadata |
| `onlineVisibility` | `status` | ⚠ 语义不同 | false → status=`archived` 或映射到 `hidden_online` 标记存 metadata |
| `ecomSeoData` | ✗ | gap | 存 metadata，future 做 SEO 字段 |

### 2.2 CatalogItem → MenuItem

| Square 字段 | 现有 `MenuItem` 字段 | 状态 | 方案 |
|---|---|---|---|
| `name` | `name` | ✓ | — |
| `description` / `descriptionPlaintext` | `description` | ✓ | 优先 `descriptionPlaintext`，fallback `description` |
| `descriptionHtml` | ✗ | gap | 存 `sourceMetadata.descriptionHtml`；future 可增字段 |
| `abbreviation` | ✗ | gap | metadata |
| `labelColor` | ✗ | gap | metadata |
| `isTaxable` | ✗（通过 MenuItemTax 关联） | 语义不同 | 若 `isTaxable=false` 且无 taxIds，则不创建 MenuItemTax 关联；存 metadata |
| `categoryId` (deprecated) + `categories[]` + `reportingCategory` | `categoryItems[]`（多对多） | ⚠ 当前只读单个 categoryId | **修复**：改读 `categories[]` 数组；若为空回退 `categoryId`；`reportingCategory` 作为首个 |
| `buyerFacingName` | ✗ | gap | metadata |
| `kitchenName` | ✗ | gap | **新增字段** `MenuItem.kitchenName String?` |
| `taxIds[]` | 通过 `menuItemTaxes` 关联 | ✓ 现有机制支持 | mapper 需 resolve tax external→internal，建立 `MenuItemTax` |
| `modifierListInfo[]` | `modifiers` JSON | 部分 | 详见 2.4 |
| `variations[]` | `modifiers.groups[0]`（合成 "Size"） | 部分 | 详见 2.3 |
| `productType` | ✗ | gap | metadata；非 `REGULAR`/`FOOD_AND_BEV` 的（如 `APPOINTMENTS_SERVICE`）跳过并记日志 |
| `skipModifierScreen` | ✗ | gap | metadata |
| `itemOptions[]` | ✗ | gap | 详见 2.5 |
| `imageIds[]` | `imageUrl`（单张） | 部分 | 首张→`imageUrl`；列表→`sourceMetadata.imageUrls` |
| `sortName` | ✗ | gap | metadata（日语场景） |
| `channels[]` | ✗ | gap | metadata |
| `isArchived` | `status=archived` | ⚠ 映射 | `isArchived=true` → `status="archived"` |
| `ecomSeoData` | ✗ | gap | metadata |
| `foodAndBeverageDetails`（dietary / ingredients / calorie） | `nutrition` / `tags` JSON | 部分 | 将 dietary → `tags`；ingredients → `sourceMetadata.ingredients`；calorie → `nutrition.calories` |
| `isAlcoholic` | ✗ | gap | 加入 `tags` 中的 `"alcoholic"`；同时存 `sourceMetadata.isAlcoholic` |
| `reportingCategory` | `categoryItems[]` 首项 | 语义不同 | 存 `sourceMetadata.reportingCategoryExternalId` |

**新增 MenuItem 字段**（additive，不破坏现有数据）：
- `kitchenName String?` — 厨房显示名
- `pricingType String @default("FIXED")` — `FIXED` | `VARIABLE`（variable 场景 price 可为 0）
- `sourceMetadata Json?` — 供 Square 等集成回收未首类化的字段

### 2.3 CatalogItemVariation → 合成 modifier group

当前策略：**保留** 把 variations 折叠成一个 `Size` modifier group 的做法（不引入 first-class variation 表，blast radius 太大）。但在 mapper 层需保留 variation 的完整元数据到 `sourceMetadata.variations[]`，便于 future phase 平滑迁移。

| Square 字段 | 当前折叠策略 | 状态 | 方案 |
|---|---|---|---|
| `name` | option.name | ✓ | — |
| `priceMoney` | option.price（相对基础价差） | ✓ | — |
| `pricingType` (`FIXED_PRICING`/`VARIABLE_PRICING`) | ✗ | gap | 若所有 variation 均为 `VARIABLE_PRICING` → item.pricingType=`VARIABLE`，price=0；否则 FIXED。写入 `sourceMetadata.variations[i].pricingType` |
| `sku` | ✗ | gap | `sourceMetadata.variations[i].sku` |
| `upc` | ✗ | gap | `sourceMetadata.variations[i].upc` |
| `ordinal` | 位置隐式 | 部分 | 用 ordinal 排序后再折叠 |
| `locationOverrides[]` | ✗ | gap | metadata；多门店价格本期不支持 |
| `trackInventory` / `inventoryAlertType` / `inventoryAlertThreshold` | ✗ | gap | metadata；库存本期不支持 |
| `sellable` / `stockable` | ✗ | gap | `sellable=false` 则跳过此 variation；否则 metadata |
| `measurementUnitId` | ✗ | gap | metadata（按 2.7） |
| `itemOptionValues[]` | ✗ | gap | metadata（按 2.5） |
| `imageIds[]` | ✗ | gap | metadata |
| `kitchenName` | ✗ | gap | metadata |

### 2.4 CatalogModifierList + CatalogModifier → Modifier JSON

**现有 JSON 结构**（`src/services/menu/menu.types.ts`）：
```ts
ModifierGroupInput: { id, name, type: "single"|"multiple", required, allowQuantity?, maxQuantityPerModifier?, modifiers[] }
ModifierInput: { id, name, price, isDefault?, isAvailable?, availabilityNote? }
```

需要把 mapper 产出的 `MappedModifierGroup` 扩成一个**超集**类型 `SquareMappedModifierGroup`，然后由 persistence 层负责把字段对齐到 `ModifierGroupInput`（已有字段直接映射；新字段进 metadata）。

| Square `CatalogModifierList` 字段 | Mapped 字段 | 状态 |
|---|---|---|
| `name` | `name` | ✓ |
| `ordinal` | `ordinal`（新增） | 补 |
| `selectionType`（deprecated） | 忽略，改用 min/max | 修复 |
| `modifiers[]` | `options[]` | ✓ |
| `allowQuantities` | `allowQuantity` | ✓（已有字段） |
| `modifierType` (`LIST`/`TEXT`) | `modifierType`（新增） | TEXT 类型本期**标记并跳过**，日志 warn，存 metadata |
| `maxLength` / `textRequired` | `textConfig`（新增 metadata） | TEXT-only，随 modifierType 走 |
| `internalName` | `internalName`（新增） | 补 |
| `minSelectedModifiers` | `minSelect` | **修复**：当前写死 0/1，改读 Square 值，-1 视为未设 |
| `maxSelectedModifiers` | `maxSelect` | **修复**：同上 |
| `hiddenFromCustomer` | `hiddenFromCustomer`（新增） | 补 |
| `imageIds[]` | metadata | gap |
| `isConversational` | metadata | gap |

**CatalogItemModifierListInfo**（item 级 override，优先级更高）：
- `enabled` — 当前已处理
- `minSelectedModifiers` / `maxSelectedModifiers` — **修复**：作为 override 生效，优先于 modifier list 上的值
- `ordinal` — 用于排序 modifier group
- `modifierOverrides[]` — 指定 modifier 的 `onByDefault` / `hidden` override，存 metadata
- `allowQuantities` / `hiddenFromCustomerOverride` — override modifier list 上的设置

**CatalogModifier**（选项级别）：

| Square 字段 | Mapped option 字段 | 状态 |
|---|---|---|
| `name` | `name` | ✓ |
| `priceMoney` | `price` | ✓ |
| `onByDefault` | `isDefault` | 补 |
| `ordinal` | `ordinal`（新增） | 补，用于排序 |
| `kitchenName` | `kitchenName`（新增） | 补 |
| `imageId` | `imageUrl`（新增，解引用 IMAGE） | 补 |
| `hiddenOnline` | `hiddenOnline`（新增） | 补；`true` 则跳过 |
| `locationOverrides[]` | metadata | gap |

### 2.5 CatalogItemOption / CatalogItemOptionValue（矩阵式选项）

Square 的 ItemOption 是多维矩阵变体（e.g. 尺寸 × 颜色），variations 通过 `itemOptionValues[]` 与之关联。这是和 ModifierList 不同的概念。

**现有系统完全不支持。** 本期降级策略：

1. **展平成合成 modifier group**：把每个 ItemOption 转成一个 `single`-select modifier group，option values 转成 options。
2. **保留原始信息**：`MappedMenuItem.sourceMetadata.itemOptions` 保留 option id + values，便于 future 迁移到 first-class 表。
3. **variations 与 itemOptionValues 的关系**：当前把 variations 折叠为 Size group 时，如果 variation 有 `itemOptionValues[]`，在 mapper 里先按 itemOption 维度合成多个 group（代替单一的 Size group）；variation 的 `name` 往往由 Square 自动生成（如 "Large / Red"）。
4. **限制**：矩阵展平后的所有组合对应多个 modifier 选项集合，但**不会重建组合→价格**的矩阵关系 —— 这是已知限制，spec 明确记录。Future phase 需要 first-class `MenuItemOption` + `MenuItemVariation` 表。

### 2.6 CatalogTax → TaxConfig / MerchantTaxRate

| Square 字段 | 现有字段 | 状态 | 方案 |
|---|---|---|---|
| `name` | `TaxConfig.name` | ✓ | — |
| `percentage` | `MerchantTaxRate.rate` | ✓ | 注意精度：`Decimal(5,4)` 上限 9.9999%；**修复**：改成 `Decimal(6,4)` 以支持最多 99.9999% |
| `inclusionType` (`ADDITIVE`/`INCLUSIVE`) | ✗ | **关键 gap** | **新增** `TaxConfig.inclusionType String @default("ADDITIVE")` |
| `calculationPhase` (`TAX_SUBTOTAL_PHASE`/`TAX_TOTAL_PHASE`) | ✗ | gap | **新增** `TaxConfig.calculationPhase String @default("SUBTOTAL")` |
| `appliesToCustomAmounts` | ✗ | gap | `TaxConfig.appliesToCustomAmounts Boolean @default(false)` |
| `enabled` | `status=active` | ✓ | — |
| `appliesToProductSetId` | ✗ | 显式 out of scope | 忽略 |

### 2.7 CatalogMeasurementUnit

Square variations 可用 `measurementUnitId` 引用 `MEASUREMENT_UNIT` 对象（e.g. `per slice`, `per lb`）。

**方案**：新增 Prisma 模型
```prisma
model MeasurementUnit {
  id          String   @id
  tenantId    String   @map("tenant_id")
  name        String   // "per slice", "pound", ...
  abbreviation String? // "slice", "lb"
  precision   Int      @default(0) // 小数位
  type        String   // "GENERIC" | "WEIGHT" | "VOLUME" | "LENGTH" | "AREA" | "TIME"
  externalSource String? @map("external_source")
  externalId     String? @map("external_id")
  deleted     Boolean  @default(false)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  tenant      Tenant   @relation(fields: [tenantId], references: [id])

  @@unique([tenantId, externalSource, externalId])
  @@index([tenantId])
  @@map("measurement_units")
}
```

Variations 通过 `sourceMetadata.variations[i].measurementUnitId` 引用。Future phase 引入 first-class variation 表时再建外键。

### 2.8 CatalogImage

Square `IMAGE` 是独立对象，被 Category / Item / Modifier 等通过 `imageIds[]` 引用。

**本期方案**（避免新建表）：
1. Fetch catalog 时额外拉 `IMAGE` 对象，构建 `imageId → url` 内存 map。
2. Mapper 解引用：首张 → `imageUrl` 字段（现有）；全部 URL → `sourceMetadata.imageUrls`。
3. Future phase：新增 `MenuImage` 表做 first-class。

---

## 3. 核心 Schema 改动汇总

所有改动**纯 additive**，不破坏现有数据与 API：

```prisma
model MenuItem {
  // ...existing fields
  kitchenName    String?  @map("kitchen_name")
  pricingType    String   @default("FIXED") @map("pricing_type")   // FIXED | VARIABLE
  sourceMetadata Json?    @map("source_metadata")
  // ...
}

model TaxConfig {
  // ...existing fields
  inclusionType           String  @default("ADDITIVE") @map("inclusion_type")      // ADDITIVE | INCLUSIVE
  calculationPhase        String  @default("SUBTOTAL") @map("calculation_phase")   // SUBTOTAL | TOTAL
  appliesToCustomAmounts  Boolean @default(false)      @map("applies_to_custom_amounts")
  // ...
}

model MerchantTaxRate {
  rate Decimal @db.Decimal(6, 4)  // 原 (5,4) → (6,4)，兼容 >9.9999% 税率
  // ...
}

model MeasurementUnit { /* 见 2.7 */ }
```

迁移策略：`npm run db:push`（dev）+ 手写 migration 文件进 prod。默认值保证存量数据不需要 backfill。

---

## 4. Mapper 输出类型升级

`src/services/square/square-catalog.service.ts` 中的 `MappedMenuItem` / `MappedModifierGroup` 类型扩展为 Square 映射的超集。新增字段：

```ts
interface MappedModifierOption {
  name: string;
  price: number;
  externalId: string;
  // 新增
  isDefault: boolean;
  ordinal: number | null;
  kitchenName: string | null;
  imageUrl: string | null;
  hiddenOnline: boolean;
}

interface MappedModifierGroup {
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: MappedModifierOption[];
  // 新增
  type: "single" | "multiple" | "text";
  ordinal: number | null;
  allowQuantity: boolean;
  hiddenFromCustomer: boolean;
  internalName: string | null;
  sourceKind: "MODIFIER_LIST" | "VARIATION" | "ITEM_OPTION";  // 区分来源
}

interface MappedMenuItem {
  externalId: string;
  name: string;
  description: string | null;
  price: number;
  pricingType: "FIXED" | "VARIABLE";   // 新增
  kitchenName: string | null;           // 新增
  categoryExternalIds: string[];        // 修复：支持多 category
  imageUrl: string | null;              // 新增：首张图
  tags: string[];                        // 新增：dietary + isAlcoholic
  taxExternalIds: string[];              // 新增：Square item.taxIds
  modifiers: MappedModifiers | null;
  variationMappings: MappedVariationMapping[];  // 升级为富结构
  sourceMetadata: Record<string, unknown>;       // 未首类化的字段
}

interface MappedVariationMapping {
  externalId: string;
  name: string;
  sku: string | null;
  upc: string | null;
  pricingType: "FIXED" | "VARIABLE";
  priceAmount: number;
  measurementUnitId: string | null;
  ordinal: number;
  sellable: boolean;
  itemOptionValues: { itemOptionId: string; itemOptionValueId: string }[];
}

interface MappedTax {
  externalId: string;
  name: string;
  percentage: number;
  inclusionType: "ADDITIVE" | "INCLUSIVE";     // 新增
  calculationPhase: "SUBTOTAL" | "TOTAL";       // 新增
  appliesToCustomAmounts: boolean;               // 新增
}
```

### Mapper 修复要点

1. **废弃 `selectionType`**：改用 `minSelectedModifiers` / `maxSelectedModifiers`（-1 = 未设，退回到 allowQuantity 或 modifier 总数）。
2. **Item 级 override 优先**：`CatalogItemModifierListInfo.min/maxSelectedModifiers` 优先于 list 级。
3. **多 category**：读 `itemData.categories[]`，回退 `itemData.categoryId`（向后兼容 2023-12-13 前的 API）。
4. **过滤**：`sellable=false` 的 variation 跳过；`hiddenOnline=true` 的 modifier 跳过；`productType` 非 `REGULAR` / `FOOD_AND_BEV` 的 item 跳过并日志 warn。
5. **TEXT 类型 modifier list**：标记 group type=`text`，options 为空数组，metadata 保留 maxLength/textRequired。persistence 层暂时跳过此类 group。
6. **ItemOption 展平**：若 item 有 `itemOptions[]`，读取所有关联的 `ITEM_OPTION` + `ITEM_OPTION_VALUE`，为每个 option 生成一个 `sourceKind=ITEM_OPTION` 的合成 group；替代 variation 折叠逻辑。
7. **Image 解引用**：需要一个 `imageMap: Map<string, string>` 作为 mapper 入参；调用方（sync 流程）在 fetch 时预先拉 `IMAGE` 对象填充。
8. **Tax 扩字段**：`inclusionType` / `calculationPhase` / `appliesToCustomAmounts` 来自 `CatalogTax`。

---

## 5. Persistence 层对齐

`SquareCatalogService` 的产物是 `MappedCatalog`。Persistence 层（尚未实装，属于 future phase `square catalog sync` 的一部分）按以下规则落库：

- `MappedMenuItem` → `MenuItem`
  - 核心字段直接写
  - 新增 `kitchenName` / `pricingType` / `sourceMetadata`
  - `tags` → `MenuItem.tags` JSON
  - `modifiers` 由 `SquareMappedModifierGroup` 转成 `ModifierGroupInput`（已有字段保留，新字段放 `sourceMetadata.modifierGroupsExtra`）
- `MappedTax` → `TaxConfig` + `MerchantTaxRate`
  - 新字段直接写
- `MappedCategory` → `MenuCategory`
  - 单 category 字段不变；多 category 关系通过 `MenuCategoryItem` 扇出

---

## 6. 已知限制（Future Phase）

| 限制 | 解决时机 |
|---|---|
| 无 first-class `MenuItemVariation` 表，variations 仍折叠为 modifier | Phase 2：引入独立 variation 表 + 重构 cart / order / dashboard |
| 无 first-class `MenuItemOption` 矩阵 | Phase 2：随 variation 表同步 |
| 无 first-class `MenuImage` 表 | Phase 2 |
| 不支持 category 层级（parent/root） | 按产品诉求再决定 |
| 不支持 variation 库存（trackInventory / alert） | Phase 3：单独 inventory 模块 |
| 不支持 POS 独有字段（channels / POS label / locationOverrides 等） | 不计划（POS-only） |
| 不支持 Discount / PricingRule / ProductSet | 显式 out of scope |
| 不支持矩阵 variation 的 option 组合独立定价 | 随 Phase 2 |
| 不支持 Square 多门店价格 override | Phase 3 |

---

## 7. 本期实装范围（对应 PR）

**In PR**:
- 本 spec 文档
- Prisma schema：`MenuItem.kitchenName` / `pricingType` / `sourceMetadata`；`TaxConfig.inclusionType` / `calculationPhase` / `appliesToCustomAmounts`；`MerchantTaxRate.rate` 精度 (6,4)；新 `MeasurementUnit` 模型
- `MappedCatalog` 类型升级 + mapper 重写
- 单元测试覆盖新字段
- `db:push` 应用 schema

**Not in PR**（留作 follow-up）：
- Persistence 层（DB 写入）对齐新类型 —— 属于 `square catalog sync` 实装任务
- `MenuImage` / first-class variation / ItemOption 表
- Dashboard UI 暴露新字段
- Migration SQL（本期先 `db:push`）

---

## 8. 测试策略

单元测试 `square-catalog-mapping.test.ts` 新增覆盖：

1. `pricingType=VARIABLE` 的 variation → item.pricingType=VARIABLE、price=0
2. `min/maxSelectedModifiers` 正确从 modifier list 读取且被 item-level override 覆盖
3. 多 category item（`itemData.categories[]`）→ `categoryExternalIds` 含全部
4. Tax 的 inclusionType / calculationPhase / appliesToCustomAmounts 映射
5. TEXT 型 modifier list → group.type='text'，options 为空
6. `onByDefault`、`ordinal`、`kitchenName`、`hiddenOnline` 字段透传
7. `isArchived=true` → item 被跳过（或打成 archived 状态）
8. `sellable=false` variation 被过滤
9. `hiddenOnline=true` modifier 被过滤
10. `measurementUnitId` 保留到 sourceMetadata
11. `itemOptions` 展平为合成 group
12. `imageIds[]` 经 imageMap 解引用得到 URL 列表
13. `foodAndBeverageDetails` → tags / nutrition / isAlcoholic
14. 向后兼容：不含新字段的旧 fixture 依然返回合理默认值
