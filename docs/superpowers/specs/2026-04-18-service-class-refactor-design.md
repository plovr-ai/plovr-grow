# Service 层重构：放弃 class 写法（第一阶段）

**Issue**: [#310](https://github.com/plovr-ai/plovr-grow/issues/310)
**Date**: 2026-04-18
**Scope**: 第一个 PR（渐进迁移的第一步）

## 背景

`src/services/` 下 35 个 service 全部以 class 单例模式导出（`export class XxxService` + `export const xxxService = new XxxService()`）。这个模式带来以下摩擦：

- `this` 在解构或作为 callback 传递时会丢绑定（`const { getMerchantBySlug } = merchantService` 踩坑）
- 与函数式 HOF 组合别扭（React `cache()`、`memoize`、`withTransaction` 套在 class method 上需额外包装）
- 35 个 class 里只有 3 个用到 constructor 参数；其余 32 个 class 的 constructor 从未被外部调用
- CLAUDE.md 里"便于后续拆分微服务"的理由站不住——拆微服务的边界是模块划分与接口契约，与是否 class 无关

Issue #303 需要给 `merchantService.getMerchantBySlug` 与 `getTenantBySlug` 包 React `cache()`，class 写法下要么改成 arrow field（破坏继承链），要么顶层定义 cached helper 再让 method 委托（多一层间接）。对象字面量写法能零样板落地。

## 范围

**本 PR 仅做第一阶段**，按 issue 要求的"按子领域分 PR"推进：

1. 更新 CLAUDE.md — 建立 service 导出规范
2. 迁移 `src/services/merchant/merchant.service.ts`
3. 迁移 `src/services/tenant/tenant.service.ts`

后续子领域（`menu/`、`order/`、`loyalty/` 等）在后续独立 PR 中推进，不在本 PR 范围。

本 PR **不迁移**：

- `generator.service.ts`（有 DI 构造参数）
- `sms.service.ts`（有 DI 构造参数）
- `google-places.client.ts`（有 DI 构造参数）

这 3 个作为历史例外保留为 class，CLAUDE.md 约定中标注 TODO 后续以工厂函数形式迁移。

## 决策记录

| # | 决策点 | 选择 |
|---|--------|------|
| 1 | 第一个 PR 范围 | CLAUDE.md + merchant + tenant 两个子领域 |
| 2 | CLAUDE.md 约定强度 | 硬性规则（禁止 `export class XxxService`） |
| 3 | 方法内互调方式 | 模块级函数 + 对象字面量聚合（方法间通过函数名直接引用，不用 `this`） |
| 4 | 测试策略 | 只跑现有测试验证，不新增 refactor 验证测试 |

## 设计

### 1. CLAUDE.md 约定更新

在"Service 层参数规范"章节下方新增"Service 层导出规范"：

```markdown
### Service 层导出规范

- **禁止** `export class XxxService` 写法
- Service 必须导出对象字面量：`export const xxxService = { ... }`
- 方法实现采用"模块级函数 + 对象字面量聚合"模式：

  ```typescript
  // 1. 方法先声明为模块级 async function
  async function getMerchantBySlug(slug: string) { ... }
  async function getMerchantById(tenantId: string, id: string) { ... }

  // 2. 方法内互调用直接引用函数名，不使用 this/xxxService.xxx
  async function getCompanyMerchantBySlug(slug: string) {
    return getMerchantBySlug(slug);
  }

  // 3. 对外导出为对象字面量聚合所有方法
  export const merchantService = {
    getMerchantBySlug,
    getMerchantById,
    getCompanyMerchantBySlug,
  };
  ```

- `private`/`protected` 成员 → 模块级 `const`/`function` 不 export 即等效 private
- **DI 例外**：确有构造参数依赖的，用工厂函数 `createXxxService(deps)` 返回对象字面量，不用 class

**历史例外（待后续迁移）**：

- `src/services/generator/generator.service.ts` — 依赖 `GooglePlacesClient`
- `src/services/sms/sms.service.ts` — 依赖 `SmsProvider`
- `src/services/generator/google-places.client.ts` — 依赖 API key

这 3 个暂时保留为 class，后续通过独立 PR 迁移为工厂函数形式。
```

### 2. merchant.service.ts 迁移

**当前状态**：

- 398 行
- `export class MerchantService { ... }` + `export const merchantService = new MerchantService()`
- 6 处 `this.xxx()` 内部互调（`getMerchantBySlug` / `getMerchantById` / `getTenantBySlug` / `getMerchant`）
- 无 `private` / `protected` 成员
- 68 个 import 点分布在 62 个文件

**迁移后**：

```typescript
// 方法声明为模块级 async function
async function getMerchantBySlug(slug: string) { ... }
async function getMerchantById(tenantId: string, id: string) { ... }
async function getTenantBySlug(companySlug: string) { ... }
async function getMerchant(tenantId: string, merchantId: string) { ... }

// 互调用直接引用函数名
async function getCompanyMerchantBySlug(slug: string) {
  return getMerchantBySlug(slug);
}

async function getMerchantWithTenantBySlug(merchantSlug: string) {
  const merchant = await getMerchantBySlug(merchantSlug);
  // ...
}

// 导出对象字面量
export const merchantService = {
  getMerchantBySlug,
  getCompanyMerchantBySlug,
  getMerchantWithTenantBySlug,
  getTenantBySlug,
  getMerchant,
  getMerchantById,
  // ... 其余方法
};
```

**兼容性**：

- 调用点形式 `merchantService.getMerchantBySlug(...)` **零改动**
- 测试 mock 形式 `vi.mock("@/services/merchant", () => ({ merchantService: { ... } }))` **零改动**
- 受影响：import `MerchantService` 类本身的地方（需检查，预期 0 处）

### 3. tenant.service.ts 迁移

**当前状态**：

- 456 行
- `export class TenantService { ... }` + `export const tenantService = new TenantService()`
- 0 处 `this.xxx()` 互调（最简单）
- 无 `private` / `protected` 成员
- 27 个 import 点分布在 21 个文件

**迁移模式**：与 merchant 相同。无 `this` 互调意味着转换更机械。

### 4. 对 #303 的影响

迁移后 #303 的实现变得一行：

```typescript
import { cache } from "react";

// Before (class 写法需要额外包装):
// export const getMerchantBySlugCached = cache(async (slug) => merchantService.getMerchantBySlug(slug));

// After (对象字面量写法可直接用):
const getMerchantBySlug = cache(async (slug: string) => { /* body */ });
export const merchantService = { getMerchantBySlug, ... };
```

但 cache 包装不在本 PR 范围，由 #303 的 PR 独立推进。

## 验收标准

- [ ] `npm run build` 通过
- [ ] `npm run lint` 通过
- [ ] `npm run test:run` 全绿（含覆盖率门槛）
- [ ] `export class MerchantService` / `export class TenantService` 在代码库中不存在
- [ ] 所有 `merchantService.xxx(...)` / `tenantService.xxx(...)` 调用点无需修改
- [ ] CLAUDE.md 新增"Service 层导出规范"章节
- [ ] 3 个 DI class（generator/sms/google-places）保持不变

## 风险与回滚

**风险**：极低。对象字面量包装 class 实例在运行时语义等价；`vi.mock` 对两者兼容；TypeScript 类型推断对两者也兼容。

**回滚**：若出现意外，直接 revert PR。不涉及数据库、API、业务逻辑变更。

## 不做的事（本 PR 范围外）

- 不迁移其余 30 个 service class（留给后续子领域 PR）
- 不迁移 3 个 DI class（需要单独设计工厂函数接口）
- 不添加 React `cache()` 包装（留给 #303 的 PR）
- 不改动测试代码（现有测试就是回归保证）
- 不修改调用点的 import 语句或调用形式
