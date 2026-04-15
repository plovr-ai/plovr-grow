# URL 路由规范

## 路由总览

**必须严格区分品牌级 (`/{companySlug}`) 和门店级 (`/r/{merchantSlug}`) 路由**。

| 级别 | URL 模式 | Slug 类型 | 页面 |
|------|----------|-----------|------|
| 营销 | `/` | — | Website 营销首页 |
| 品牌级 | `/{companySlug}` | `companySlug` | 官网首页 |
| 品牌级 | `/{companySlug}/locations` | `companySlug` | 门店列表 |
| 品牌级 | `/{companySlug}/giftcard` | `companySlug` | 礼品卡 |
| 门店级 | `/r/{merchantSlug}/menu` | `merchantSlug` | 菜单页 |
| 门店级 | `/r/{merchantSlug}/cart` | `merchantSlug` | 购物车 |
| 门店级 | `/r/{merchantSlug}/checkout` | `merchantSlug` | 结账页 |
| 门店级 | `/r/{merchantSlug}/orders/{orderId}` | `merchantSlug` | 订单详情 |
| 门店级 | `/r/{merchantSlug}/catering` | `merchantSlug` | 餐饮承包 |
| Dashboard | `/dashboard` | — | 商户后台 |
| Admin | `/admin` | — | 内部管理 |

## 用户流程示例
```
访问 /joes-pizza (品牌官网)
  ↓
点击 "Order Online"
  ↓
单门店 → 直接跳转 /r/joes-pizza-downtown/menu
多门店 → 跳转 /joes-pizza/locations 选择门店
  ↓
浏览菜单 → 添加到购物车 → 结账
```

## 组件中构建链接的规范

```typescript
// ✅ 正确 - 品牌级页面使用 companySlug
const homeLink = `/${companySlug}`;
const locationsLink = `/${companySlug}/locations`;

// ✅ 正确 - 门店级页面使用 merchantSlug
const menuLink = `/r/${merchantSlug}/menu`;
const cartLink = `/r/${merchantSlug}/cart`;
const checkoutLink = `/r/${merchantSlug}/checkout`;

// ❌ 错误 - 混淆 slug 类型
const locationsLink = `/r/${merchantSlug}/locations`;  // locations 是品牌级页面！
const menuLink = `/${companySlug}/menu`;               // menu 是门店级页面！
```

## 跨级别导航
- 从门店页面返回品牌官网：需要获取 `companySlug`（通过 merchant.tenant.slug）
- 从品牌官网进入门店页面：需要获取 `merchantSlug`（通过 tenant.merchants[].slug）

> 注：`companySlug` 是历史遗留的 URL 参数名，实际对应 `tenant.slug`（Tenant = 租户/品牌）。
