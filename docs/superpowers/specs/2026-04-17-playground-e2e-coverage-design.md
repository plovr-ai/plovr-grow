# Playground E2E Coverage Design

**Issue**: #294 — 增加 playground 的 E2E 测试
**Date**: 2026-04-17
**Branch**: `test/playground-e2e-coverage`

## Summary

为 `/playground` 增加真正的 **Layer A E2E**：在 JSDOM 下让 **真实的 `@pipecat-ai/client-js` SDK** 跑起来，仅把 mock 下沉到浏览器 `WebSocket` 一层，由 in-process fake phone-ai WS server 做对端。替换现有的 `PhoneSimulator.e2e.test.tsx`（当前整体 mock 掉了 SDK），增量覆盖 SDK + RTVI 协议层，并显式钉住"phone-ai 是否发 `bot-ready`"两种生产模式。

Layer B（plovr-phone-ai 接口契约）与 Layer C（全链路冒烟）本次**不做**——前者由已有 `phone-ai-order-flow.integration.test.ts` 覆盖，后者缺少可运行环境，留待日后。

---

## Scope

### In Scope
1. Pipecat SDK 升级破坏 RTVI 消息解析（`userTranscript` / `botTranscript` / `disconnected` / `error`）
2. `src/lib/pipecat/client.ts` 的 connect/disconnect 生命周期，**特别是** 第 128–146 行"监听 `connected` 事件解锁 connect() Promise"的兼容 hack
3. PhoneSimulator UI 交互回归（start / hangup / mute / transcript 渲染 / 错误显示）——继承旧文件 8 个场景
4. quick-call HTTP 失败路径
5. 传输层异常（中途断线、握手被拒）
6. phone-ai 兼容性：**`bot-ready` 有或无两种模式下 playground 都正常工作**

### Out of Scope（PR 描述显式说明）
- 订单是否真落库（issue 中的第 #3 诉求）——由 `src/app/api/external/v1/__tests__/phone-ai-order-flow.integration.test.ts` 覆盖
- phone-ai 服务内部 LLM / STT / TTS 行为——外部 repo，不在本仓库测
- 真实浏览器的 mic 权限对话框、getUserMedia 真实实现、渲染差异——属 Layer C，本次不做

---

## Architecture

### Mock 边界图

```
┌──────────────────────────────────────────┐
│  PhoneSimulator.tsx  (真，React 组件)    │
└──────────┬───────────────────────────────┘
           │ useCallback → startCall()
┌──────────▼───────────────────────────────┐
│  src/lib/pipecat/client.ts  (真)         │
└─┬───────────────────────────────────┬────┘
  │ fetch(quick-call)                 │ new PipecatClient + transport
  │                                   │
┌─▼────────────┐        ┌─────────────▼─────────────┐
│ global.fetch │        │ @pipecat-ai/client-js     │
│  (mock)      │        │ + websocket-transport     │ ← 真 SDK
│              │        │ 调 navigator.getUserMedia │
│              │        │ 调 new WebSocket(wsUrl)   │
└──────────────┘        └─┬────────────┬────────────┘
                          │            │
                ┌─────────▼──┐  ┌──────▼──────────────┐
                │getUserMedia│  │  global.WebSocket    │
                │ (stub)     │  │  (mock-socket 接管) │
                └────────────┘  └──────┬──────────────┘
                                       │
                          ┌────────────▼────────────┐
                          │  fakePhoneAiServer (新) │
                          │  in-process WS server   │
                          │  scripting API 暴露给测试│
                          └─────────────────────────┘
```

**决定性选择**：mock **不高于 SDK**、**不低于 WS**，正好卡在 `global.WebSocket`。SDK 版本升级、RTVI 解析、connect/disconnect 握手全部在测试覆盖里。

### Dev 依赖
- `mock-socket`（~5KB，零依赖，MIT，JSDOM 兼容性成熟）

---

## Fixture 设计

### 新增文件结构

```
src/app/(website)/playground/components/__tests__/
  PhoneSimulator.e2e.test.tsx          ← 重写
  fixtures/
    fakePhoneAiServer.ts               ← 核心：in-process WS 伪服务端
    rtviMessages.ts                    ← RTVI payload builders
    browserStubs.ts                    ← getUserMedia / 全局补丁
```

### `fakePhoneAiServer.ts` 公共 API

```ts
interface FakePhoneAiServer {
  url: string;                                       // 测试里返给 quick-call mock
  awaitConnection(): Promise<void>;                  // 等 SDK 完成 WS 握手
  sendBotReady(): void;                              // 模拟 phone-ai "修好了" 的 RTVI bot-ready
  sendBotTranscript(text: string): void;
  sendUserTranscript(text: string, opts: { final: boolean }): void;
  sendError(type: string, opts?: { fatal?: boolean }): void;
  closeFromServer(): void;                           // 模拟服务端主动断
  receivedMessages: unknown[];                       // SDK 发来的消息，可供调试
  stop(): Promise<void>;                             // afterEach 清理
}

function createFakePhoneAiServer(): FakePhoneAiServer;
```

**默认行为**：构造时**不**自动发 `bot-ready`，匹配当前 prod；测试需要 "修好了" 场景时手动调 `sendBotReady()`。

### 关键实现约束
1. **不默认发 `bot-ready`**——这是 production 实际行为（见 `.claude/.../memory/project_phone_ai_rtvi_protocol.md`）；若 fake server 误默认发送，会悄悄把 `client.ts:128` 那条兼容 hack 的测试价值掩盖掉
2. **`navigator.mediaDevices.getUserMedia` 必须返回能被 `WavMediaManager` 正常消费的 MediaStream**——fake `MediaStreamTrack` 需要 `stop()`、`getAudioTracks()`、`getTracks()` 方法
3. **RTVI 消息格式**：写第一版时读 `node_modules/@pipecat-ai/client-js/dist/` 的类型定义，把确切 shape 固化在 `rtviMessages.ts`，不凭 README 猜（MISTAKES.md #262 教训）
4. **每个 test 起独立的 server + 独立的 URL**，`afterEach` 干净 close——避免 MISTAKES.md #184 式跨用例监听器泄漏

---

## 测试场景清单（13 条）

### A. 基础生命周期（继承旧文件 8 条，1:1 迁移）

| # | 场景 | 关键断言 |
|---|---|---|
| 1 | happy path: start → live → bot speaks → user speaks → hangup | UI: Connecting → Live → Call Ended；fake server 收到 disconnect |
| 2 | mute 切换不中断通话 | `enableMic` 被调；Live 保持 |
| 3 | interim transcript 显示预览，final 变正式消息 | 两种状态分别渲染 |
| 4 | **非** fatal error 仅上报到 UI，通话继续 | error 文本可见；Live 保持；disconnect 未被触发 |
| 5 | quick-call HTTP 失败 → UI 显示错误，绝不 connect | fetch 失败；fake server 未收到连接 |
| 6 | 回归 #291：多次 re-render 后挂断仍生效 | 流若干 botTranscript 后点 End → disconnect 被调 |
| 7 | 组件 unmount 时自动挂断（防泄漏） | unmount 触发 close |
| 8 | 挂断按钮只触发一次 disconnect（防重复点击） | `close` 被调且只调一次 |

### B. phone-ai 兼容性（新增 2 条，本次 issue 核心）

| # | 场景 | 关键断言 |
|---|---|---|
| 9 | **phone-ai 未发 `bot-ready`（当前 prod）**：SDK 只收到 WS `connected` | 仍能进入 Live；挂断照常；验证 `client.ts:128` 的 hack 始终有效 |
| 10 | **phone-ai 发了 `bot-ready`（修复后）**：SDK 先收 `connected` 再收 `bot-ready` | Live 只进入一次（不 double-flip）；挂断照常；SDK 的 `connect()` Promise 不再挂起 |

### C. 传输层异常（新增 3 条）

| # | 场景 | 关键断言 |
|---|---|---|
| 11 | 通话中服务端主动 close WS（网络抖动） | UI 显示 Call Ended；不抛未捕获异常 |
| 12 | WS 握手阶段被拒（ws 端直接 close） | UI 显示错误；`setStatus(DISCONNECTED)`；不停留在 Connecting |
| 13 | **fatal error 自动挂断**：服务端发 `error` 且 `data.fatal=true` | error 文本可见；`client.ts` 的 `dispose()` 被触发 → fake server 看到 close |

### 场景 #9 / #10 的具体脚本

```ts
// #9 — prod 行为（默认）
const server = createFakePhoneAiServer();
// ... 渲染 + clickStart ...
await server.awaitConnection();   // WS 握手到；SDK 发出 `connected` 事件
await waitForLive();              // client.ts:128 的 hack：监听 `connected` 就 resolve
// 继续 botTranscript / hangup

// #10 — phone-ai "修好了"
const server = createFakePhoneAiServer();
// ... clickStart ...
await server.awaitConnection();
server.sendBotReady();            // 真实 RTVI bot-ready
await waitForLive();
// 断言：Live 只出现一次（计 status 回调次数，或 expect(screen.getAllByText("Live")).toHaveLength(1)）
// 断言：挂断时 disconnect() 正常 resolve（说明 connect() Promise 也正常 settled，没挂起）
```

---

## 迁移清单

1. `npm i -D mock-socket`
2. 新增 `fixtures/` 三件（`fakePhoneAiServer.ts` / `rtviMessages.ts` / `browserStubs.ts`），先独立跑通一个最小 smoke（单连接握手）
3. 重写 `PhoneSimulator.e2e.test.tsx`——旧 8 条场景 1:1 迁移，新增 #9–#12
4. 跑 `npm run test:run` + 核对 coverage（测试文件 `.tsx`，不计入 coverage 分母；只是**替换**现有测试内容，不会像 MISTAKES.md #202 那样拉低全局阈值）
5. 确认 `vitest.config.ts` 不需要改（测试文件路径不变，jsdom 环境不变）
6. PR 描述显式列 Out of Scope（#3 订单、phone-ai 内部、真浏览器）

---

## 成功判据

- 13 条场景全绿
- **设计期一次性反向检查**（确认测试真的在守东西，不入 CI）：
  - 临时删掉 `src/lib/pipecat/client.ts:128–146` 那段兼容 hack，仅 `await client.connect()` → 场景 #9 必须挂（证明：无 `bot-ready` 的 prod 行为若失去 hack 就会永久 hang，被测试捕获）
  - 临时让 fake server 在握手后**不**发 `connected` 事件 → 场景 #1 必须挂（证明：RTVI 协议消息缺失能被测试发现，不是靠 SDK 内部 timeout 蒙混过关）

---

## 现有文件的处理

- **替换** `src/app/(website)/playground/components/__tests__/PhoneSimulator.e2e.test.tsx`
- 理由：新方案严格覆盖更多（真 SDK + 真 RTVI 协议层），保留旧文件会带来双份维护与认知负担
- 8 个旧场景全部 1:1 迁移到新夹具下，行为断言不退化
