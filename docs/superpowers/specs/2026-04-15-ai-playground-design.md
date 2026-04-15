# AI Playground 语音点餐 Web 端 — 设计文档

> Issue: #262  
> Date: 2026-04-15  
> Status: Approved

## 概述

在 website 添加 `/playground` 公开页面，支持通过浏览器进行语音点餐测试。页面采用双栏布局：左侧展示菜单，右侧为手机模拟器通话体验。前端直连 plovr-phone-ai 后端，使用 Pipecat JS SDK 处理音频通信。

## 页面路由与入口

- **URL**: `/playground`，位于 `(website)` 路由组
- **入口改动**: `CallDemoCard` 的 CTA 按钮从 `/dashboard/login` 改为 `/playground`
- **环境变量**（新增）:
  ```
  NEXT_PUBLIC_PHONE_AI_API_URL=https://phone-ai.plovr.ai
  NEXT_PUBLIC_PLAYGROUND_TENANT_ID=<demo tenant id>
  NEXT_PUBLIC_PLAYGROUND_MERCHANT_ID=<demo merchant id>
  ```

## 页面布局

桌面端（≥1024px）双栏并排，移动端（<1024px）单栏。

```
┌──────────────────────────────────────────────────────┐
│  Plovr AI Voice Ordering Playground                  │
├─────────────────────────┬────────────────────────────┤
│  Menu                   │    ┌──────────────┐        │
│                         │    │  模拟手机     │        │
│  🍕 Pizza               │    │              │        │
│    Pepperoni  $14.99    │    │  Ava Agent   │        │
│    Margherita $12.99    │    │  00:32       │        │
│    Hawaiian   $13.99    │    │              │        │
│                         │    │  对话记录     │        │
│  🥤 Drinks              │    │  User: ...   │        │
│    Coke       $2.99     │    │  Ava: ...    │        │
│    Sprite     $2.99     │    │              │        │
│                         │    │ [🎤] [静音] [挂断] │   │
│                         │    └──────────────┘        │
└─────────────────────────┴────────────────────────────┘
```

## 左侧 — 菜单展示

- 服务端通过 `menuService.getMenu(tenantId, merchantId)` 获取数据
- 按分类分组展示：分类名 + 菜品列表（名称、描述、价格）
- 只读展示，不可点击加购
- 使用 `useFormatPrice()` 格式化价格

## 右侧 — 手机模拟器

### 外观

CSS 手机边框（圆角 + 阴影），固定宽高比约 375×700。

### 内部结构

```
┌─────────────────┐
│ 顶部状态栏       │  Ava · 通话状态 · 时长
├─────────────────┤
│                 │
│  对话记录区域    │  滚动区，气泡样式
│  (自动滚底)     │  User 靠右，Ava 靠左
│                 │
├─────────────────┤
│ 底部控制栏       │  [🎤静音] [挂断]
└─────────────────┘
```

### 通话状态机

```
idle → connecting → connected → disconnected
       ↑                           │
       └───────── (重新拨打) ───────┘
```

- `idle`: 显示"开始通话"按钮
- `connecting`: 显示"连接中..."动画
- `connected`: 显示通话时长计时器 + 对话记录 + 控制按钮
- `disconnected`: 显示通话结束 + "重新拨打"按钮

## 音频通信

前端直连 plovr-phone-ai，无 Next.js 代理。

### 流程

1. 页面调用 `POST ${NEXT_PUBLIC_PHONE_AI_API_URL}/api/ai/admin/playground/put-config` 获取 `ws_url`
2. `WebSocketTransport` + `RTVIClient` 连接 WebSocket
3. SDK 自动处理麦克风采集、音频编码/解码/播放
4. 监听事件：
   - `transcript` — 用户语音识别文本
   - `botText` — Ava 回复文本
   - `connected` / `disconnected` — 连接状态

### 请求体

```json
{
  "tenant_id": "<env NEXT_PUBLIC_PLAYGROUND_TENANT_ID>",
  "org_id": "<env NEXT_PUBLIC_PLAYGROUND_MERCHANT_ID>",
  "agents": []
}
```

### 依赖

- `@pipecat-ai/client-js` — RTVI 客户端
- `@pipecat-ai/websocket-transport` — WebSocket 传输层

## 对话记录组件

每条消息类型：`{ role: 'user' | 'bot', text: string, timestamp: Date }`

- 用户消息：右对齐，浅灰背景
- Ava 消息：左对齐，主题色背景
- 新消息自动滚到底部
- 连接时显示 typing indicator

## 响应式

- **桌面**（≥1024px）：双栏并排
- **移动端**（<1024px）：单栏，手机模拟器全宽居中，菜单折叠为上方可展开面板

## 文件结构

```
src/app/(website)/playground/
  page.tsx                    — 服务端页面，获取菜单数据
  components/
    PlaygroundLayout.tsx      — 双栏布局
    MenuPanel.tsx             — 左侧菜单展示
    PhoneSimulator.tsx        — 右侧手机模拟器（客户端组件）
    ConversationLog.tsx       — 对话记录
    CallControls.tsx          — 通话控制按钮
src/lib/pipecat/
  client.ts                   — RTVIClient 初始化和事件封装
  types.ts                    — 消息、通话状态等类型
```

## 不包含（阶段一范围外）

- 配置面板（Agent 选择、版本管理）
- 下单结果展示
- 通话指标/调试面板（延迟等）
- Next.js API 代理
