# Dashboard 表单组件

Dashboard 使用统一的表单组件库 (`@/components/dashboard/Form`)，提供一致的水平布局样式。

## 组件列表

| 组件 | 用途 |
|------|------|
| `FormField` | 基础容器组件 (布局 + 标签 + 错误显示) |
| `TextField` | 文本输入 (text, email, password, number) |
| `TextareaField` | 多行文本输入 |
| `PriceField` | 价格输入 (自动添加货币符号前缀) |
| `SelectField` | 下拉选择框 |
| `RadioGroupField` | 单选按钮组 |
| `CheckboxField` | 单个复选框 |

## 布局规范

默认使用**水平布局**：
- 标签宽度: 120px
- 标签对齐: 右对齐 (`text-right`)
- 多行内容 (如 Textarea): 使用 `alignTop` 使标签顶部对齐

```
┌─────────────────────────────────────────────────┐
│  [  Label  ]  [ Input Field                   ] │
│  (120px)      (flex: 1)                         │
└─────────────────────────────────────────────────┘
```

## API 参考

```typescript
// 基础属性 (所有组件共享)
interface BaseFieldProps {
  id: string;                    // 字段 ID
  label: string;                 // 标签文字 (空字符串则不显示标签)
  required?: boolean;            // 显示红色 * 标记
  error?: string;                // 错误信息 (显示在输入框下方)
  layout?: "horizontal" | "vertical";  // 默认 "horizontal"
  labelWidth?: number;           // 标签宽度 (默认 120)
  className?: string;            // 容器 className
}

// TextField 额外属性
interface TextFieldProps extends BaseFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "email" | "password" | "number";
  disabled?: boolean;
  helperText?: string;           // 辅助文字 (显示在输入框下方)
}

// PriceField 额外属性
interface PriceFieldProps extends BaseFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;          // 默认 "0.00"
  disabled?: boolean;
  maxWidth?: string;             // 默认 "max-w-[200px]"
}
// 注: PriceField 内部使用 useDashboardCurrencySymbol() 自动获取货币符号

// SelectField 额外属性
interface SelectFieldProps extends BaseFieldProps {
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];  // 支持 readonly 数组
  disabled?: boolean;
  helperText?: string;
}
```

## 使用示例

```typescript
import {
  TextField,
  TextareaField,
  PriceField,
  SelectField,
  RadioGroupField,
  CheckboxField,
  FormField,
} from "@/components/dashboard/Form";

// 文本输入
<TextField
  id="name"
  label="Name"
  required
  value={name}
  onChange={setName}
  placeholder="e.g., Classic Burger"
  error={errors.name}
/>

// 价格输入 (自动显示货币符号)
<PriceField
  id="price"
  label="Price"
  required
  value={price}
  onChange={setPrice}
/>

// 下拉选择
<SelectField
  id="category"
  label="Category"
  value={categoryId}
  onChange={setCategoryId}
  options={categories}
  helperText="Select a category for this item"
/>

// 单选按钮组
<RadioGroupField
  id="status"
  name="status"
  label="Status"
  value={status}
  onChange={setStatus}
  options={[
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
  ]}
/>

// 自定义内容 (使用 FormField)
<FormField id="image" label="Image" alignTop>
  <ImageUploader ... />
</FormField>
```

## 何时使用原生 Input

以下场景应直接使用原生 `<Input>` 组件而非 Form 组件：

1. **内联输入**: 输入框与其他元素在同一行 (如复选框 + 标签 + 数字输入)
2. **动态列表**: 列表项内的输入 (如 Modifier 选项的名称/价格)
3. **复杂布局**: 无法用标准水平/垂直布局表达的情况

```typescript
// ✅ 使用 Form 组件: 标准表单字段
<TextField id="name" label="Name" value={name} onChange={setName} />

// ✅ 使用原生 Input: 动态列表内的内联输入
{modifiers.map((mod) => (
  <div className="flex items-center gap-2">
    <Input value={mod.name} onChange={...} />
    <Input type="number" value={mod.price} onChange={...} />
  </div>
))}
```
