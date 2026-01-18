# Onboarding Flow 测试指南

## 测试账号

我们创建了一个专门用于测试 onboarding flow 的账号：

```
📧 Email: test@example.com
🔑 Password: test123
```

这个账号关联的 Company 状态为 `not_started`，可以完整体验 onboarding 流程。

## 如何开始测试

### 1. 运行数据库迁移和种子数据

```bash
# 同步数据库 schema（如果还没运行）
npm run db:push

# 运行种子数据（创建测试账号）
npm run db:seed
```

### 2. 启动开发服务器

```bash
npm run dev
```

### 3. 登录测试账号

1. 访问 http://localhost:3000/dashboard/login
2. 使用以下凭证登录：
   - Email: `test@example.com`
   - Password: `test123`

### 4. 访问 Dashboard

登录后，访问：
```
http://localhost:3000/dashboard/merchant-onboarding-test
```

你应该会立即看到 **Onboarding Wizard**！

## Onboarding Flow 测试场景

### 场景 1: 完成所有步骤
1. 登录测试账号
2. 在每个步骤点击 "Continue"
3. 最后一步点击 "Complete Setup"
4. 应该自动跳转到正常的 Merchant Overview 页面
5. 刷新页面，不应该再看到 onboarding wizard

### 场景 2: 跳过所有步骤
1. 重置数据库：`npm run db:seed`（重新创建测试账号）
2. 登录
3. 在每个步骤点击 "Skip for Now"
4. 最后一步点击 "Complete Setup"
5. 应该自动跳转到正常页面
6. 检查数据库，所有步骤应该标记为 "skipped"

### 场景 3: 混合完成/跳过
1. 重置数据库
2. 登录
3. 第一步：点击 "Continue"
4. 第二步：点击 "Skip for Now"
5. 第三步：点击 "Complete Setup"
6. 验证完成后可以正常使用

### 场景 4: 中途退出并恢复
1. 重置数据库
2. 登录
3. 完成第一步（Website Build）
4. 刷新页面或重新登录
5. 应该从第二步（Menu Build）继续

## 验证检查点

### UI 检查
- ✅ 进度指示器正确显示当前步骤
- ✅ 已完成的步骤显示绿色勾选标记
- ✅ 跳过的步骤显示 "(Skipped)" 标签
- ✅ 导航按钮在最后一步变为 "Complete Setup"
- ✅ 按钮在加载时正确禁用

### 数据库检查
使用 Prisma Studio 查看数据：
```bash
npm run db:studio
```

检查 `companies` 表中的测试公司：
- `onboarding_status`: 应该从 `not_started` → `in_progress` → `completed`
- `onboarding_data`: JSON 字段包含步骤状态
- `onboarding_completed_at`: 完成后应该有时间戳

### 行为检查
- ✅ 完成后刷新页面不会再显示 wizard
- ✅ 完成后尝试直接访问 URL，仍然显示正常 dashboard
- ✅ Server Actions 正确更新数据库
- ✅ 页面在完成后自动刷新

## 重置测试环境

如果需要重新测试，运行：
```bash
npm run db:seed
```

这会重新创建测试账号，`onboarding_status` 重置为 `not_started`。

## 测试数据详情

### Tenant
- ID: `tenant-onboarding-test`
- Name: "Onboarding Test Restaurant"

### Company
- ID: `company-onboarding-test`
- Name: "New Restaurant"
- Status: `not_started` (初始状态)

### Merchant
- ID: `merchant-onboarding-test`
- Slug: `test-restaurant`
- Name: "Test Restaurant - Main Location"

### User
- ID: `user-onboarding-test`
- Email: `test@example.com`
- Password: `test123`
- Role: `owner`

## 常见问题

### Q: 登录后没有看到 onboarding wizard？
A: 检查：
1. 数据库中 company 的 `onboarding_status` 是否为 `not_started` 或 `in_progress`
2. URL 是否正确（需要包含 merchantId）
3. 是否已经完成过 onboarding（status = `completed`）

### Q: 点击按钮后没有反应？
A: 打开浏览器控制台查看错误。可能的原因：
1. Server Actions 执行失败
2. 数据库连接问题
3. Session 过期

### Q: 如何查看 onboarding 数据结构？
A: 使用 Prisma Studio：
```bash
npm run db:studio
```
然后查看 `companies` 表的 `onboarding_data` 字段。

## 下一步开发

当前步骤组件都是占位符。后续可以实现：

1. **Website Build 步骤**：
   - 公司信息表单（名称、描述、联系方式）
   - Logo 上传
   - 品牌颜色选择

2. **Menu Build 步骤**：
   - 创建菜单分类
   - 添加菜品
   - 设置价格和描述

3. **OO Configuration 步骤**：
   - 配置配送设置
   - 设置营业时间
   - 配置支付方式
   - 最低订单金额等

每个步骤组件位于：
```
/src/components/onboarding/steps/
├── WebsiteStep.tsx
├── MenuStep.tsx
└── OOConfigStep.tsx
```
