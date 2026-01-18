# Onboarding Flow 快速开始

## 🎯 测试账号

```
📧 Email: onboarding@example.com
🔑 Password: password123
```

## 🚀 快速开始（3 步）

### 1. 启动开发服务器

```bash
npm run dev
```

**注意**：开发服务器启动时会自动初始化 mock 测试账号，你会在终端看到：

```
[Test Data] Initializing test accounts...
[Test Data] Created user: admin@test.com
[Test Data] Created user: manager@test.com
[Test Data] Created user: staff@test.com
[Test Data] Created onboarding test user: onboarding@example.com
[Test Data] Initialization complete!

Test Accounts:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
...
🎯 Email: onboarding@example.com
🔑 Password: password123
👤 Role: owner
✨ Status: NOT onboarded (test onboarding flow!)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 2. 登录测试账号

1. 访问：http://localhost:3000/dashboard/login
2. 输入：
   - Email: `onboarding@example.com`
   - Password: `password123`
3. 点击 "Sign in"

### 3. 体验 Onboarding Flow

登录成功后，访问任意 dashboard 页面，例如：
```
http://localhost:3000/dashboard/merchant-onboarding-test
```

你会立即看到 **Onboarding Wizard**！

## 🎨 Onboarding Flow 功能

### 界面展示
- ✅ 欢迎标题："Welcome to Reborn!"
- ✅ 进度指示器（显示 3 个步骤）
- ✅ 当前步骤高亮显示
- ✅ 已完成步骤显示绿色勾选
- ✅ 跳过的步骤显示 "(Skipped)" 标签

### 3 个步骤
1. **Website Build** - 设置餐厅网站和品牌（占位符）
2. **Menu Build** - 创建菜单分类和菜品（占位符）
3. **Online Ordering** - 配置在线订餐设置（占位符）

### 操作按钮
- **Skip for Now** - 跳过当前步骤
- **Continue** - 完成当前步骤并进入下一步
- **Complete Setup** - 最后一步的完成按钮

## 🧪 测试场景

### 场景 1: 完成所有步骤
1. 在每个步骤点击 "Continue"
2. 最后一步点击 "Complete Setup"
3. ✅ 应该自动跳转到正常的 Merchant Overview 页面
4. ✅ 刷新页面，不应再看到 wizard

### 场景 2: 跳过所有步骤
1. 在每个步骤点击 "Skip for Now"
2. 最后一步点击 "Complete Setup"
3. ✅ 应该自动跳转到正常页面

### 场景 3: 混合操作
1. 第一步：点击 "Continue"
2. 第二步：点击 "Skip for Now"
3. 第三步：点击 "Complete Setup"
4. ✅ 正常完成

### 场景 4: 中途退出
1. 完成第一步
2. 刷新页面或重新登录
3. ✅ 应该从第二步继续（记住进度）

## 🔄 重置测试环境

如果需要重新测试 onboarding flow：

### 方法 1: 重启开发服务器
```bash
# 停止服务器 (Ctrl+C)
npm run dev
```

Mock 数据会重新初始化，onboarding 状态重置为 `not_started`。

### 方法 2: 使用其他测试账号

系统还提供了其他已完成 onboarding 的账号：

```
Email: admin@test.com
Password: password123
```

这个账号的 onboarding 已完成，会直接显示正常 dashboard。

## 🏗️ 技术架构说明

### 当前实现方式

系统使用 **混合数据源**：

1. **登录验证** → Mock 数据（内存）
   - 用户、租户、公司数据存储在 `mockUserStore`
   - 启动服务器时自动初始化

2. **页面数据查询** → 数据库（Prisma）
   - Company 和 Merchant 数据从数据库读取
   - 需要运行 `npm run db:seed` 创建数据

### Mock 账号与数据库对应关系

| Mock 账号 | 数据库 Company ID | Merchant ID |
|-----------|-------------------|-------------|
| onboarding@example.com | company-onboarding-test | merchant-onboarding-test |

## ❓ 常见问题

### Q: 登录后看不到 onboarding wizard？

**可能原因**：
1. 使用了错误的账号（如 `admin@test.com` 已完成 onboarding）
2. Merchant ID 错误
3. 已经完成过 onboarding

**解决方案**：
- 确保使用 `onboarding@example.com`
- 访问正确的 URL：`/dashboard/merchant-onboarding-test`
- 重启开发服务器重置状态

### Q: 提示 "invalid email"？

**可能原因**：
- 邮箱输入错误
- 开发服务器没有启动（mock 数据未初始化）

**解决方案**：
- 确保邮箱是 `onboarding@example.com`（全小写）
- 重启开发服务器：`npm run dev`
- 检查终端是否显示测试账号初始化成功

### Q: 登录提示 "Invalid email or password"？

**可能原因**：
- 密码错误

**解决方案**：
- 确保密码是 `password123`（全小写）

### Q: 完成 onboarding 后如何再次测试？

**解决方案**：
- 重启开发服务器（Ctrl+C 然后 `npm run dev`）
- Mock 数据会重新初始化

## 📋 下一步开发

当前步骤组件都是占位符，后续可以实现：

### 1. Website Build 步骤
- 公司信息表单（名称、描述、联系方式）
- Logo 上传功能
- 品牌颜色选择器

### 2. Menu Build 步骤
- 创建菜单分类
- 添加菜品和价格
- 设置菜品图片

### 3. OO Configuration 步骤
- 配送设置（配送范围、费用）
- 营业时间设置
- 支付方式配置
- 最低订单金额

步骤组件位于：
```
/src/components/onboarding/steps/
├── WebsiteStep.tsx
├── MenuStep.tsx
└── OOConfigStep.tsx
```

## 💡 提示

- 每次修改代码后，无需重启服务器（Next.js 热重载）
- 但如果想重置 onboarding 状态，需要重启服务器
- Mock 数据仅在内存中，重启后会丢失（这是我们想要的测试行为）
