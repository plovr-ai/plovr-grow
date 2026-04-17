# Playground E2E Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `/playground` 增加真正的 Layer A E2E：JSDOM + 真实 `@pipecat-ai/client-js` SDK + `mock-socket` fake phone-ai WS server，覆盖 13 个场景（含 `bot-ready` 有/无两种 phone-ai 兼容模式），替换现有整体 mock SDK 的 `PhoneSimulator.e2e.test.tsx`。

**Architecture:**
- Mock 边界：**`WavMediaManager` 类**（JSDOM 没有 AudioContext/getUserMedia） + **`global.WebSocket`**（由 `mock-socket` 接管）
- 真实运行：`PipecatClient`、`WebSocketTransport`、`ProtobufFrameSerializer`、`src/lib/pipecat/client.ts`、`PhoneSimulator.tsx`、React 事件循环
- Fake server 对称使用**真的** `ProtobufFrameSerializer` 编解码 RTVI 消息（避免造协议半拉子）

**Tech Stack:** Vitest + JSDOM、React Testing Library、`@pipecat-ai/client-js` 2.x、`@pipecat-ai/websocket-transport` 2.x、新增 `mock-socket`

**Spec:** `docs/superpowers/specs/2026-04-17-playground-e2e-coverage-design.md`

**Issue:** #294

---

## File Structure

### Create
- `src/app/(website)/playground/components/__tests__/fixtures/browserStubs.ts` — mock `WavMediaManager` + 其它浏览器 API 补丁
- `src/app/(website)/playground/components/__tests__/fixtures/rtviMessages.ts` — 用真实 `RTVIMessage` 类构造 `bot-ready` / `user-transcription` / `bot-transcription` / `error` 等入站消息
- `src/app/(website)/playground/components/__tests__/fixtures/fakePhoneAiServer.ts` — `mock-socket` Server 包装，对称使用 `ProtobufFrameSerializer`，暴露脚本化 API

### Modify / Replace
- `src/app/(website)/playground/components/__tests__/PhoneSimulator.e2e.test.tsx` — **整体重写**（保留 8 场景语义 + 新增 5 场景，从"mock SDK"改为"mock WavMediaManager + WS"）
- `package.json` — 加 devDep `mock-socket`

### Do Not Modify
- `src/app/(website)/playground/components/PhoneSimulator.tsx`
- `src/lib/pipecat/client.ts` —— 包括第 128–146 行的 `bot-ready` 兼容 hack，这正是 scenario #9 要守的东西
- `src/lib/pipecat/types.ts`

---

## Task 1: 安装 `mock-socket` 依赖

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: 安装为 devDependency**

Run: `npm i -D mock-socket`

Expected: `package.json` 的 `devDependencies` 出现 `"mock-socket": "^9.x"`；`package-lock.json` 更新。

- [ ] **Step 2: 验证可 import（JSDOM 环境下）**

Run: `npx vitest --run -t "__smoke_nonexistent__" 2>&1 | head -5` （仅加载 vitest，不跑任何测试）

Expected: 无错误；之后手动在 node REPL 里执行 `require("mock-socket")` 不报错。如果 npm REPL 不方便，跳过这步。

- [ ] **Step 3: 提交**

```bash
git add package.json package-lock.json
git commit -m "chore: add mock-socket devDep for playground E2E (#294)"
```

---

## Task 2: `browserStubs.ts` — WavMediaManager + 其它 stub

**Files:**
- Create: `src/app/(website)/playground/components/__tests__/fixtures/browserStubs.ts`

**背景 / 约束：**
- JSDOM 无 `AudioContext` / `getUserMedia`，真实 `WavMediaManager` 内部会炸
- 直接 mock 整个 `@pipecat-ai/websocket-transport` 会把 `WebSocketTransport` 也替换掉，失去测试价值
- 正确做法：通过 `vi.mock("@pipecat-ai/websocket-transport", async () => { const actual = await vi.importActual(...); return { ...actual, WavMediaManager: FakeWavMediaManager } })` 只替换 `WavMediaManager`
- 本文件导出 `FakeWavMediaManager` 类 + `installBrowserStubs()` 辅助函数（如果有其它需要补的全局），不直接调 `vi.mock`——mock 声明在测试文件里做（vitest hoisting 要求）

- [ ] **Step 1: 写 `FakeWavMediaManager` 类**

Create `src/app/(website)/playground/components/__tests__/fixtures/browserStubs.ts`:

```ts
/**
 * Browser-layer stubs for JSDOM.
 *
 * Why: real `WavMediaManager` calls `AudioContext` + `getUserMedia`, neither
 * of which exists in JSDOM. We swap ONLY `WavMediaManager` and leave
 * `WebSocketTransport`, `ProtobufFrameSerializer`, and the rest of the SDK
 * fully real so RTVI protocol + connect/disconnect lifecycle are exercised.
 *
 * Consumer (in the test file) does:
 *   vi.mock("@pipecat-ai/websocket-transport", async () => {
 *     const actual = await vi.importActual<typeof import("@pipecat-ai/websocket-transport")>(
 *       "@pipecat-ai/websocket-transport",
 *     );
 *     return { ...actual, WavMediaManager: FakeWavMediaManager };
 *   });
 */

export class FakeWavMediaManager {
  private _micEnabled = true;
  private _userAudioCallback: ((data: ArrayBuffer) => void) | null = null;

  setUserAudioCallback(cb: (data: ArrayBuffer) => void): void {
    this._userAudioCallback = cb;
  }
  setClientOptions(): void {}
  async initialize(): Promise<void> {}
  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  async userStartedSpeaking(): Promise<unknown> {
    return undefined;
  }
  bufferBotAudio(): Int16Array {
    return new Int16Array();
  }
  async getAllMics(): Promise<MediaDeviceInfo[]> {
    return [];
  }
  async getAllCams(): Promise<MediaDeviceInfo[]> {
    return [];
  }
  async getAllSpeakers(): Promise<MediaDeviceInfo[]> {
    return [];
  }
  updateMic(): void {}
  updateCam(): void {}
  updateSpeaker(): void {}
  get selectedMic(): MediaDeviceInfo | Record<string, never> {
    return {};
  }
  get selectedCam(): MediaDeviceInfo | Record<string, never> {
    return {};
  }
  get selectedSpeaker(): MediaDeviceInfo | Record<string, never> {
    return {};
  }
  enableMic(enable: boolean): void {
    this._micEnabled = enable;
  }
  enableCam(): void {}
  enableScreenShare(): void {}
  get isMicEnabled(): boolean {
    return this._micEnabled;
  }
  get isCamEnabled(): boolean {
    return false;
  }
  get isSharingScreen(): boolean {
    return false;
  }
  get supportsScreenShare(): boolean {
    return false;
  }
  tracks(): Record<string, never> {
    return {};
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add src/app/\(website\)/playground/components/__tests__/fixtures/browserStubs.ts
git commit -m "test: add FakeWavMediaManager stub for playground E2E (#294)"
```

---

## Task 3: `rtviMessages.ts` — RTVI 消息 builder

**Files:**
- Create: `src/app/(website)/playground/components/__tests__/fixtures/rtviMessages.ts`

**背景 / 约束：**
- 参考 `node_modules/@pipecat-ai/client-js/dist/index.d.ts` 第 70-114 行的 `RTVIMessageType` enum
- 入站消息类型（服务端→客户端）：`bot-ready`、`user-transcription`、`bot-transcription`、`error`
- `RTVIMessage` 构造签名：`new RTVIMessage(type: string, data: unknown, id?: string)` — 自动填 `label = "rtvi-ai"`
- 关联类型形状（已在 `.d.ts` 确认）：
  - `TranscriptData = { text: string; final: boolean; timestamp: string; user_id: string }`
  - `BotLLMTextData = { text: string }`
  - `BotReadyData = { version: string; about?: unknown }`
  - `ErrorData = { message: string; fatal: boolean }`
- 注：`bot-transcription` 的 data 是 `BotLLMTextData` 形状

- [ ] **Step 1: 写 builder 函数**

Create `src/app/(website)/playground/components/__tests__/fixtures/rtviMessages.ts`:

```ts
/**
 * Builders for inbound RTVI messages (server → client).
 *
 * Exact shapes come from node_modules/@pipecat-ai/client-js/dist/index.d.ts:
 * `RTVIMessageType` enum, `TranscriptData`, `BotLLMTextData`, `BotReadyData`,
 * `ErrorData`. Do NOT invent fields — add them here only when confirmed in
 * the SDK typedefs (see MISTAKES.md #262 for why).
 */
import {
  RTVIMessage,
  RTVIMessageType,
  type TranscriptData,
  type BotLLMTextData,
  type BotReadyData,
  type ErrorData,
} from "@pipecat-ai/client-js";

export function botReady(overrides: Partial<BotReadyData> = {}): RTVIMessage {
  const data: BotReadyData = { version: "1.2.0", ...overrides };
  return new RTVIMessage(RTVIMessageType.BOT_READY, data);
}

export function userTranscription(
  text: string,
  final: boolean,
): RTVIMessage {
  const data: TranscriptData = {
    text,
    final,
    timestamp: new Date().toISOString(),
    user_id: "test-user",
  };
  return new RTVIMessage(RTVIMessageType.USER_TRANSCRIPTION, data);
}

export function botTranscription(text: string): RTVIMessage {
  const data: BotLLMTextData = { text };
  return new RTVIMessage(RTVIMessageType.BOT_TRANSCRIPTION, data);
}

export function errorMessage(message: string, fatal = false): RTVIMessage {
  const data: ErrorData = { message, fatal };
  return new RTVIMessage(RTVIMessageType.ERROR, data);
}
```

- [ ] **Step 2: 提交**

```bash
git add src/app/\(website\)/playground/components/__tests__/fixtures/rtviMessages.ts
git commit -m "test: add RTVI message builders for playground E2E (#294)"
```

---

## Task 4: `fakePhoneAiServer.ts` — 核心 fake WS server

**Files:**
- Create: `src/app/(website)/playground/components/__tests__/fixtures/fakePhoneAiServer.ts`

**背景 / 约束：**
- `mock-socket` 的 `Server` 类接管 `global.WebSocket`，构造时需给个独立 URL
- 对称使用真实的 `ProtobufFrameSerializer`——双向协议真实
- **默认 `bot-ready` 不自动发**（匹配 plovr-phone-ai 生产行为）
- `awaitConnection()` 在 `connection` 事件 resolve
- 每次 `createFakePhoneAiServer()` 生成唯一 URL（UUID）避免 mock-socket 的 URL 冲突
- SDK 客户端会 send 消息（`client-ready` 等），fake server 默认忽略但记录在 `receivedMessages`

- [ ] **Step 1: 写 fake server**

Create `src/app/(website)/playground/components/__tests__/fixtures/fakePhoneAiServer.ts`:

```ts
import { Server, type Client } from "mock-socket";
import { ProtobufFrameSerializer } from "@pipecat-ai/websocket-transport";
import type { RTVIMessage } from "@pipecat-ai/client-js";
import {
  botReady,
  botTranscription,
  userTranscription,
  errorMessage,
} from "./rtviMessages";

export interface FakePhoneAiServer {
  /** ws:// URL passed to the quick-call mock response body. */
  readonly url: string;
  /** Resolves when SDK completes the WS handshake. */
  awaitConnection(): Promise<void>;
  /** Whether any client has connected to this server. */
  isConnected(): boolean;
  /** Whether the current connection has been closed (either side). */
  isClosed(): boolean;
  /** Simulate phone-ai "fixed" behavior: send RTVI bot-ready frame. */
  sendBotReady(): void;
  sendBotTranscript(text: string): void;
  sendUserTranscript(text: string, opts: { final: boolean }): void;
  /** Send an RTVI error. `fatal: true` triggers client.ts dispose(). */
  sendError(message: string, opts?: { fatal?: boolean }): void;
  /** Server-initiated close (simulate network drop mid-call). */
  closeFromServer(): void;
  /** Raw inbound frames from SDK (decoded protobuf → RTVIMessage or audio). */
  readonly receivedMessages: Array<RTVIMessage | { audio: Int16Array }>;
  /** Clean up (afterEach). */
  stop(): Promise<void>;
}

let _serverCounter = 0;

export function createFakePhoneAiServer(): FakePhoneAiServer {
  _serverCounter += 1;
  const url = `ws://fake-phone-ai.test/session-${_serverCounter}-${Date.now()}`;
  const server = new Server(url);
  const serializer = new ProtobufFrameSerializer();

  let connectedClient: Client | null = null;
  let closed = false;
  const received: Array<RTVIMessage | { audio: Int16Array }> = [];
  const connectionWaiters: Array<() => void> = [];

  server.on("connection", (socket) => {
    connectedClient = socket;
    closed = false;
    connectionWaiters.splice(0).forEach((resolve) => resolve());

    socket.on("message", async (data) => {
      // mock-socket gives us the raw payload; SDK serialized it with
      // the same ProtobufFrameSerializer. Round-trip it for recording.
      try {
        const parsed = await serializer.deserialize(data);
        if (parsed.type === "message") {
          received.push(parsed.message);
        } else if (parsed.type === "audio") {
          received.push({ audio: parsed.audio });
        }
      } catch {
        // best-effort debug collector; don't fail test on malformed frames
      }
    });

    socket.on("close", () => {
      closed = true;
    });
  });

  function send(message: RTVIMessage): void {
    if (!connectedClient) {
      throw new Error(
        "fakePhoneAiServer: no active connection — did you forget awaitConnection()?",
      );
    }
    const encoded = serializer.serializeMessage(message);
    connectedClient.send(encoded);
  }

  return {
    url,
    awaitConnection(): Promise<void> {
      if (connectedClient) return Promise.resolve();
      return new Promise<void>((resolve) => {
        connectionWaiters.push(resolve);
      });
    },
    isConnected(): boolean {
      return connectedClient !== null && !closed;
    },
    isClosed(): boolean {
      return closed;
    },
    sendBotReady(): void {
      send(botReady());
    },
    sendBotTranscript(text: string): void {
      send(botTranscription(text));
    },
    sendUserTranscript(text: string, opts: { final: boolean }): void {
      send(userTranscription(text, opts.final));
    },
    sendError(message: string, opts: { fatal?: boolean } = {}): void {
      send(errorMessage(message, opts.fatal ?? false));
    },
    closeFromServer(): void {
      if (connectedClient) {
        connectedClient.close();
        closed = true;
      }
    },
    get receivedMessages() {
      return received;
    },
    async stop(): Promise<void> {
      if (connectedClient && !closed) {
        try {
          connectedClient.close();
        } catch {
          // already closing
        }
      }
      server.stop();
    },
  };
}
```

- [ ] **Step 2: 提交**

```bash
git add src/app/\(website\)/playground/components/__tests__/fixtures/fakePhoneAiServer.ts
git commit -m "test: add fakePhoneAiServer fixture for playground E2E (#294)"
```

---

## Task 5: 重写测试文件 — 场景 #1（happy path）+ 共享 setup

**Files:**
- Modify (rewrite): `src/app/(website)/playground/components/__tests__/PhoneSimulator.e2e.test.tsx`

**背景 / 约束：**
- 整体重写：先只写 describe + beforeEach/afterEach + 场景 #1。其它场景后续 task 依次加
- `vi.mock` 声明必须在 import 之前（vitest 自动 hoist），而 `FakeWavMediaManager` 的引用放在 `vi.hoisted` 里（MISTAKES.md #184 教训）
- `vi.resetModules()` 在每个 `beforeEach`——确保 `PhoneSimulator` 的 module-scope `config` 拿到新 stubEnv
- 动态 import `PhoneSimulator` 在每个测试里（旧文件里已经是这个模式）
- 每个测试起**独立** `createFakePhoneAiServer()`，`afterEach` 里 `server.stop()`

- [ ] **Step 1: 整体重写文件（只放 setup + 场景 #1）**

Write `src/app/(website)/playground/components/__tests__/PhoneSimulator.e2e.test.tsx`:

```tsx
/**
 * PhoneSimulator E2E — real Pipecat SDK + fake phone-ai WS server.
 *
 * This suite runs the REAL `@pipecat-ai/client-js` and
 * `@pipecat-ai/websocket-transport` (including `ProtobufFrameSerializer` and
 * connect/disconnect lifecycle). Mock boundary is:
 *   1. `WavMediaManager`  — JSDOM has no AudioContext / getUserMedia
 *   2. `global.WebSocket` — replaced by mock-socket; fake server is an
 *      in-process RTVI peer using the REAL ProtobufFrameSerializer.
 *
 * What this catches that the old mock-SDK tests didn't:
 *   - Pipecat SDK version upgrades breaking RTVI parsing
 *   - client.ts:128 `connected`-event hack (needed while plovr-phone-ai
 *     doesn't send `bot-ready`) — and its forward-compat with bot-ready
 *   - Real connect/disconnect state transitions
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import {
  createFakePhoneAiServer,
  type FakePhoneAiServer,
} from "./fixtures/fakePhoneAiServer";

const { FakeWavMediaManager } = vi.hoisted(async () => {
  const mod = await import("./fixtures/browserStubs");
  return { FakeWavMediaManager: mod.FakeWavMediaManager };
});

vi.mock("@pipecat-ai/websocket-transport", async () => {
  const actual = await vi.importActual<
    typeof import("@pipecat-ai/websocket-transport")
  >("@pipecat-ai/websocket-transport");
  const { FakeWavMediaManager: Fake } = await FakeWavMediaManager;
  return { ...actual, WavMediaManager: Fake };
});

let server: FakePhoneAiServer;

beforeEach(() => {
  vi.resetModules();
  server = createFakePhoneAiServer();

  vi.stubEnv("NEXT_PUBLIC_PHONE_AI_API_URL", "http://phone-ai.local");
  vi.stubEnv("NEXT_PUBLIC_PLAYGROUND_TENANT_ID", "tenant-1");
  vi.stubEnv("NEXT_PUBLIC_PLAYGROUND_MERCHANT_ID", "merchant-1");

  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ ws_url: server.url }),
  } as Response);
});

afterEach(async () => {
  await server.stop();
  vi.unstubAllEnvs();
});

async function renderPhoneSimulator() {
  const mod = await import("../PhoneSimulator");
  return render(<mod.PhoneSimulator />);
}

async function clickStartCall() {
  const btn = await screen.findByRole("button", { name: /start call/i });
  await act(async () => {
    fireEvent.click(btn);
  });
}

async function clickHangup() {
  const btn = await screen.findByRole("button", { name: /end call/i });
  await act(async () => {
    fireEvent.click(btn);
  });
}

async function waitForLive() {
  await waitFor(() => {
    expect(screen.getByText("Live")).toBeInTheDocument();
  });
}

async function waitForCallEnded() {
  await waitFor(() => {
    expect(screen.getByText("Call Ended")).toBeInTheDocument();
  });
}

describe("PhoneSimulator E2E — full lifecycle with real SDK", () => {
  it("happy path: start → live → bot speaks → user speaks → hangup", async () => {
    await renderPhoneSimulator();

    expect(screen.getByRole("button", { name: /start call/i })).toBeInTheDocument();
    expect(screen.queryByText("Live")).not.toBeInTheDocument();

    await clickStartCall();
    expect(global.fetch).toHaveBeenCalledWith(
      "http://phone-ai.local/api/ai/admin/playground/quick-call",
      expect.objectContaining({ method: "POST" }),
    );

    await server.awaitConnection();
    await waitForLive();

    act(() => {
      server.sendBotTranscript("Welcome to Burger Shack.");
    });
    await waitFor(() => {
      expect(screen.getByText("Welcome to Burger Shack.")).toBeInTheDocument();
    });

    act(() => {
      server.sendUserTranscript("I'd like a burger", { final: true });
    });
    await waitFor(() => {
      expect(screen.getByText("I'd like a burger")).toBeInTheDocument();
    });

    await clickHangup();
    await waitForCallEnded();
    await waitFor(() => {
      expect(server.isClosed()).toBe(true);
    });
    expect(screen.queryByText("Live")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 跑测试**

Run: `npx vitest run src/app/\(website\)/playground/components/__tests__/PhoneSimulator.e2e.test.tsx -t "happy path"`

Expected: PASS.

若 FAIL，排查顺序：
1. fixture bug — 检查 mock-socket server 起来没、URL 对不对
2. RTVI 消息格式 — 对照 `.d.ts` 的 `TranscriptData`/`BotLLMTextData` 再比对
3. `FakeWavMediaManager` 缺方法 — SDK 调的方法没 stub，加上
4. `vi.hoisted` + 动态 import 的组合在 vitest 里有版本敏感；如果出 `Cannot access 'FakeWavMediaManager' before initialization`，把 hoisted 改为 sync 形式（import 改为 require 或直接 inline class）

- [ ] **Step 3: 提交**

```bash
git add src/app/\(website\)/playground/components/__tests__/PhoneSimulator.e2e.test.tsx
git commit -m "test: rewrite PhoneSimulator E2E to use real SDK + fake WS (happy path)"
```

---

## Task 6: 迁移场景 #2 + #3 — mute + interim transcript

**Files:**
- Modify: `src/app/(website)/playground/components/__tests__/PhoneSimulator.e2e.test.tsx`

- [ ] **Step 1: 在 describe 块里追加两个 it**

Append to the `describe` block (after scenario #1):

```tsx
  it("mute button toggles SDK mic state without ending the call", async () => {
    await renderPhoneSimulator();
    await clickStartCall();
    await server.awaitConnection();
    await waitForLive();

    const muteBtn = screen.getByRole("button", { name: /mute/i });
    await act(async () => {
      fireEvent.click(muteBtn);
    });

    const unmuteBtn = await screen.findByRole("button", { name: /unmute/i });
    await act(async () => {
      fireEvent.click(unmuteBtn);
    });

    // Call still alive, SDK never told to disconnect.
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(server.isClosed()).toBe(false);
  });

  it("interim user transcripts render as preview, finals render as message", async () => {
    await renderPhoneSimulator();
    await clickStartCall();
    await server.awaitConnection();
    await waitForLive();

    act(() => {
      server.sendUserTranscript("I'd like", { final: false });
    });
    await waitFor(() => {
      expect(screen.getByText(/I'd like/)).toBeInTheDocument();
    });

    act(() => {
      server.sendUserTranscript("I'd like a burger", { final: true });
    });
    await waitFor(() => {
      expect(screen.getByText("I'd like a burger")).toBeInTheDocument();
    });
  });
```

- [ ] **Step 2: 跑新加的两个测试**

Run: `npx vitest run src/app/\(website\)/playground/components/__tests__/PhoneSimulator.e2e.test.tsx -t "mute button|interim"`

Expected: 两条 PASS。

- [ ] **Step 3: 提交**

```bash
git add src/app/\(website\)/playground/components/__tests__/PhoneSimulator.e2e.test.tsx
git commit -m "test: add mute + interim transcript scenarios (#294)"
```

---

## Task 7: 迁移场景 #4 + #5 — 非 fatal error / quick-call 失败

**Files:**
- Modify: `src/app/(website)/playground/components/__tests__/PhoneSimulator.e2e.test.tsx`

- [ ] **Step 1: 追加两个 it**

Append:

```tsx
  it("non-fatal error surfaces to UI but call keeps going", async () => {
    await renderPhoneSimulator();
    await clickStartCall();
    await server.awaitConnection();
    await waitForLive();

    act(() => {
      server.sendError("transport-hiccup", { fatal: false });
    });
    await waitFor(() => {
      // client.ts passes message.type ("error") into setError.
      // Non-fatal means dispose() is NOT called.
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });

    // Call still alive — fatal=false must not auto-disconnect.
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(server.isClosed()).toBe(false);
  });

  it("quick-call HTTP failure surfaces error and never opens WS", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      text: async () => "tenant disabled",
    } as Response);

    await renderPhoneSimulator();
    await clickStartCall();

    await waitFor(() => {
      expect(screen.getByText(/tenant disabled/)).toBeInTheDocument();
    });
    expect(server.isConnected()).toBe(false);
    expect(screen.queryByText("Live")).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: 跑新加的两个测试**

Run: `npx vitest run src/app/\(website\)/playground/components/__tests__/PhoneSimulator.e2e.test.tsx -t "non-fatal|quick-call HTTP"`

Expected: 两条 PASS。若 "error" 文本匹配不到，调整断言——查看 `ConversationLog` / PhoneSimulator 对 `onError` 回调的渲染方式（`message.type` 字符串直接注入 `<div>`）。

- [ ] **Step 3: 提交**

```bash
git add src/app/\(website\)/playground/components/__tests__/PhoneSimulator.e2e.test.tsx
git commit -m "test: add non-fatal error + quick-call failure scenarios (#294)"
```

---

## Task 8: 迁移场景 #6 + #7 + #8 — 再挂断回归 / unmount / 重复点击

**Files:**
- Modify: `src/app/(website)/playground/components/__tests__/PhoneSimulator.e2e.test.tsx`

- [ ] **Step 1: 追加三个 it**

Append:

```tsx
  it("regression #291: hangup still disconnects after many re-renders mid-call", async () => {
    await renderPhoneSimulator();
    await clickStartCall();
    await server.awaitConnection();
    await waitForLive();

    for (let i = 0; i < 5; i++) {
      act(() => {
        server.sendBotTranscript(`chunk ${i}`);
      });
    }
    await waitFor(() => {
      expect(screen.getByText("chunk 4")).toBeInTheDocument();
    });

    await clickHangup();
    await waitForCallEnded();
    await waitFor(() => {
      expect(server.isClosed()).toBe(true);
    });
  });

  it("unmounting mid-call disconnects the SDK (leak guard)", async () => {
    const { unmount } = await renderPhoneSimulator();
    await clickStartCall();
    await server.awaitConnection();
    await waitForLive();

    expect(server.isClosed()).toBe(false);
    unmount();

    await waitFor(() => {
      expect(server.isClosed()).toBe(true);
    });
  });

  it("hangup button is safe against double-click (one disconnect only)", async () => {
    await renderPhoneSimulator();
    await clickStartCall();
    await server.awaitConnection();
    await waitForLive();

    await clickHangup();
    await waitForCallEnded();

    // After disconnect, button unmounts; attempting another click is a no-op.
    // Assert server saw exactly one close.
    expect(server.isClosed()).toBe(true);
    // mock-socket fires `close` once per socket. We rely on fake server
    // not having re-opened; isConnected should be false.
    expect(server.isConnected()).toBe(false);
  });
```

- [ ] **Step 2: 跑新加的三个测试**

Run: `npx vitest run src/app/\(website\)/playground/components/__tests__/PhoneSimulator.e2e.test.tsx -t "regression #291|unmounting|double-click"`

Expected: 三条 PASS。

- [ ] **Step 3: 提交**

```bash
git add src/app/\(website\)/playground/components/__tests__/PhoneSimulator.e2e.test.tsx
git commit -m "test: add re-render regression + unmount + double-click scenarios (#294)"
```

---

## Task 9: **核心** — 场景 #9（prod：无 bot-ready）

**Files:**
- Modify: `src/app/(website)/playground/components/__tests__/PhoneSimulator.e2e.test.tsx`

**背景：这是 issue #294 真正的新增价值之一。**

- [ ] **Step 1: 追加场景 #9**

Append:

```tsx
  it("phone-ai prod mode: no bot-ready ever sent — UI still reaches Live via `connected` hack", async () => {
    // Default fakePhoneAiServer does NOT auto-send bot-ready.
    // This matches current plovr-phone-ai production behavior and guards the
    // compatibility hack at src/lib/pipecat/client.ts:128–146 (resolve connect
    // promise on the `connected` event, not on `bot-ready`).
    await renderPhoneSimulator();
    await clickStartCall();
    await server.awaitConnection();

    // No server.sendBotReady() — simulate prod.
    await waitForLive();

    // Call works end-to-end: transcripts flow, hangup clean.
    act(() => {
      server.sendBotTranscript("Hello from plovr-phone-ai prod");
    });
    await waitFor(() => {
      expect(screen.getByText("Hello from plovr-phone-ai prod")).toBeInTheDocument();
    });

    await clickHangup();
    await waitForCallEnded();
    await waitFor(() => {
      expect(server.isClosed()).toBe(true);
    });
  });
```

- [ ] **Step 2: 跑测试**

Run: `npx vitest run src/app/\(website\)/playground/components/__tests__/PhoneSimulator.e2e.test.tsx -t "no bot-ready"`

Expected: PASS.

- [ ] **Step 3: 提交**

```bash
git add src/app/\(website\)/playground/components/__tests__/PhoneSimulator.e2e.test.tsx
git commit -m "test: cover phone-ai prod mode (no bot-ready) — #294"
```

---

## Task 10: **核心** — 场景 #10（future：phone-ai 修好后发 bot-ready）

**Files:**
- Modify: `src/app/(website)/playground/components/__tests__/PhoneSimulator.e2e.test.tsx`

- [ ] **Step 1: 追加场景 #10**

Append:

```tsx
  it("phone-ai future mode: server sends bot-ready — UI reaches Live exactly once, disconnect still clean", async () => {
    await renderPhoneSimulator();
    await clickStartCall();
    await server.awaitConnection();

    // Phone-ai "fixed" — emit bot-ready after the connected event.
    act(() => {
      server.sendBotReady();
    });
    await waitForLive();

    // Assert Live appears exactly once (no double-flip from two settle paths).
    expect(screen.getAllByText("Live")).toHaveLength(1);

    // Disconnect must settle cleanly — if the old connect() promise from SDK
    // also resolves, there should be no dangling state.
    await clickHangup();
    await waitForCallEnded();
    await waitFor(() => {
      expect(server.isClosed()).toBe(true);
    });
  });
```

- [ ] **Step 2: 跑测试**

Run: `npx vitest run src/app/\(website\)/playground/components/__tests__/PhoneSimulator.e2e.test.tsx -t "future mode"`

Expected: PASS.

- [ ] **Step 3: 提交**

```bash
git add src/app/\(website\)/playground/components/__tests__/PhoneSimulator.e2e.test.tsx
git commit -m "test: cover phone-ai future mode (bot-ready sent) — #294"
```

---

## Task 11: 传输层异常 — 场景 #11 + #12 + #13

**Files:**
- Modify: `src/app/(website)/playground/components/__tests__/PhoneSimulator.e2e.test.tsx`

- [ ] **Step 1: 追加三个 it**

Append:

```tsx
  it("server closes WS mid-call — UI flips to Call Ended, no unhandled throw", async () => {
    await renderPhoneSimulator();
    await clickStartCall();
    await server.awaitConnection();
    await waitForLive();

    act(() => {
      server.closeFromServer();
    });

    await waitForCallEnded();
    expect(server.isClosed()).toBe(true);
  });

  it("WS handshake rejected — UI shows error, status returns to DISCONNECTED", async () => {
    // Close server before the SDK connects. We stop() the default server
    // and swap in one that immediately closes on connect.
    await server.stop();

    server = createFakePhoneAiServer();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ ws_url: server.url }),
    } as Response);

    // Install a one-shot "close on connect" behavior via awaitConnection + close.
    void (async () => {
      await server.awaitConnection();
      server.closeFromServer();
    })();

    await renderPhoneSimulator();
    await clickStartCall();

    // handleStart catches the thrown error and calls setError + setStatus(DISCONNECTED).
    await waitFor(() => {
      expect(screen.getByText(/call ended|error/i)).toBeInTheDocument();
    });
    expect(screen.queryByText("Live")).not.toBeInTheDocument();
  });

  it("fatal error triggers auto-hangup via client.ts dispose()", async () => {
    await renderPhoneSimulator();
    await clickStartCall();
    await server.awaitConnection();
    await waitForLive();

    act(() => {
      server.sendError("fatal-boom", { fatal: true });
    });

    // error surfaced + client.ts dispose() closes WS
    await waitFor(() => {
      expect(server.isClosed()).toBe(true);
    });
    await waitForCallEnded();
  });
```

- [ ] **Step 2: 跑新加的三个测试**

Run: `npx vitest run src/app/\(website\)/playground/components/__tests__/PhoneSimulator.e2e.test.tsx -t "server closes|handshake rejected|fatal error"`

Expected: 三条 PASS。

若 "handshake rejected" FAIL：
- `ReconnectingWebSocket`（SDK 内部包装）有重连逻辑，可能让测试挂起或行为超出预期。若如此，在该测试里改成：让 `global.fetch` 返回一个指向**未启动**的 server URL，依靠 SDK 的 connection timeout + outer promise 的 `.catch(err)` 分支走到 `setError`
- 或直接 `throw` 在 fetch mock 里，改测 quick-call 之外的早期错误路径

- [ ] **Step 3: 提交**

```bash
git add src/app/\(website\)/playground/components/__tests__/PhoneSimulator.e2e.test.tsx
git commit -m "test: add transport anomaly + fatal error scenarios (#294)"
```

---

## Task 12: 全量跑 + coverage 检查

**Files:**
- (no source changes)

- [ ] **Step 1: 跑整个 E2E 文件的 13 条**

Run: `npx vitest run src/app/\(website\)/playground/components/__tests__/PhoneSimulator.e2e.test.tsx`

Expected: 13 passed.

- [ ] **Step 2: 跑整套单测确认没破坏其它测试**

Run: `npm run test:run 2>&1 | tail -30`

Expected: 无 ERROR 行，全量 PASS（**按 MISTAKES.md #202 教训，检查 `Coverage summary:` 行，确认 lines/branches/functions/statements 都 ≥ 阈值 97/94/97/97**）

- [ ] **Step 3: TypeScript 检查**

Run: `npx tsc --noEmit`

Expected: 无错误。若有类型错误，修到干净（MISTAKES.md #277 教训）。

- [ ] **Step 4: Lint**

Run: `npm run lint`

Expected: 0 warnings, 0 errors。

- [ ] **Step 5: 若前面任一步挂，修复后回这一步**

不需要额外 commit，除非修复了代码。

---

## Task 13: 设计期反向 sanity check（**不入 CI，做完恢复**）

**Files:**
- Temporarily modify: `src/lib/pipecat/client.ts`
- Temporarily modify: `src/app/(website)/playground/components/__tests__/fixtures/fakePhoneAiServer.ts`

**目的：证明测试确实在守东西，防止绿灯假象。做完两个 sanity check 必须 `git checkout` 还原，绝不提交。**

- [ ] **Step 1: Sanity check 1 — 删 client.ts 的 bot-ready 兼容 hack，场景 #9 必须挂**

Open `src/lib/pipecat/client.ts`. 把第 128–146 行（`await new Promise<void>((resolve, reject) => { ... })` 整块）替换为：

```ts
await client.connect();
```

Run: `npx vitest run src/app/\(website\)/playground/components/__tests__/PhoneSimulator.e2e.test.tsx -t "no bot-ready"`

Expected: **TIMEOUT 或 FAIL**（SDK 的 `connect()` 在 prod 行为下永远不 resolve，测试超时）。若此时 PASS，说明 #9 没有真实覆盖 hack —— 停下来调整断言。

Run: `git checkout src/lib/pipecat/client.ts` 还原。

- [ ] **Step 2: Sanity check 2 — fake server 不中继 connected，场景 #1 必须挂**

`connected` 是 mock-socket 的 WS 握手行为，不是 RTVI 消息 —— 删不掉。改为制造一个**握手完成但永不 resolve 任何 RTVI 消息**的极端情况不现实（SDK 本来就不依赖入站消息触发 `connected`）。换一个等价 mutation：

Open `src/app/(website)/playground/components/__tests__/fixtures/rtviMessages.ts`，把 `botTranscription` 临时改成：

```ts
export function botTranscription(_text: string): RTVIMessage {
  // MUTATION: wrong type, SDK should not fire userTranscript event
  return new RTVIMessage("unknown-type", { text: "" });
}
```

Run: `npx vitest run src/app/\(website\)/playground/components/__tests__/PhoneSimulator.e2e.test.tsx -t "happy path"`

Expected: **FAIL** in the "Welcome to Burger Shack." assertion（SDK 收到未知 type，不触发 `botTranscript` 回调 → UI 不渲染）。若此时 PASS，说明 #1 断言有问题。

Run: `git checkout src/app/\(website\)/playground/components/__tests__/fixtures/rtviMessages.ts` 还原。

- [ ] **Step 3: 最终确认还原干净**

Run: `git status`

Expected: working tree clean（没有未提交的修改）。若有，说明忘了 revert，立即 `git checkout <file>`。

- [ ] **Step 4: 再跑一次全量（确认 revert 后全绿）**

Run: `npx vitest run src/app/\(website\)/playground/components/__tests__/PhoneSimulator.e2e.test.tsx`

Expected: 13 passed.

---

## Task 14: 记录 MISTAKES.md（若实施中踩坑）

**Files:**
- Maybe modify: `MISTAKES.md`

- [ ] **Step 1: 回顾本次实施是否踩了可复用的坑**

如踩坑，追加条目（格式见现有 `MISTAKES.md`）。常见候选：
- mock-socket 与 ProtobufFrameSerializer 二进制 payload 的互操作性问题
- vi.hoisted + dynamic import 的顺序陷阱
- SDK 新版本里 RTVIMessageType enum 名字变过

若没踩坑，跳过此 task。

- [ ] **Step 2: 如有新增，commit**

```bash
git add MISTAKES.md
git commit -m "docs: record lessons learned from #294"
```

---

## Task 15: PR 准备

**Files:**
- (no code changes)

- [ ] **Step 1: 再次确认 branch 基线**

Run: `git log --oneline -15`

Expected: 看到本次一串 test: / docs: 提交，基于 `test/playground-e2e-coverage` 分支。

- [ ] **Step 2: push + 开 PR**

Run:
```bash
git push -u origin test/playground-e2e-coverage
gh pr create --title "test: add real-SDK E2E coverage for playground (#294)" --body "$(cat <<'EOF'
## Summary

Fixes #294

为 `/playground` 增加 Layer A E2E：JSDOM + 真实 `@pipecat-ai/client-js` SDK + `mock-socket` fake phone-ai WS server。13 个场景，替换原有整体 mock SDK 的测试文件。

核心增量价值：
- 钉住 `src/lib/pipecat/client.ts:128` 那条 `bot-ready` 兼容 hack（场景 #9）
- 前瞻覆盖 phone-ai 修复 `bot-ready` 后的行为（场景 #10）
- 真实 RTVI 协议（含 ProtobufFrameSerializer）参与测试，SDK 升级破坏解析会被拦下

## Changes

- `src/app/(website)/playground/components/__tests__/PhoneSimulator.e2e.test.tsx` — 整体重写
- `src/app/(website)/playground/components/__tests__/fixtures/browserStubs.ts` — `FakeWavMediaManager`
- `src/app/(website)/playground/components/__tests__/fixtures/rtviMessages.ts` — RTVI builders
- `src/app/(website)/playground/components/__tests__/fixtures/fakePhoneAiServer.ts` — mock-socket + ProtobufFrameSerializer
- `package.json` — 加 `mock-socket` devDep

## Test plan

- [x] 全部 13 场景 PASS（`PhoneSimulator.e2e.test.tsx`）
- [x] 全量单测 PASS + coverage 不降
- [x] `npx tsc --noEmit` 干净
- [x] `npm run lint` 干净
- [x] 设计期反向 sanity check：删 client.ts:128 兼容 hack → 场景 #9 FAIL（已验证）

## Out of Scope

- **订单是否真落库**（issue #294 原文第 3 项）：由 `src/app/api/external/v1/__tests__/phone-ai-order-flow.integration.test.ts` 覆盖，职责分离
- **phone-ai 服务内部 LLM/STT/TTS 行为**：外部 repo
- **真实浏览器 mic 权限/渲染差异**：属 Layer C，缺运行环境，暂不做

EOF
)"
```

- [ ] **Step 3: 记录 PR URL**

存下 `gh pr create` 返回的 URL，供 CI 监听用。

---

## Self-Review（plan 交付前 inline 过一遍）

**Spec coverage:**
- ✅ In-Scope 1（SDK 升级破坏 RTVI 解析）→ fake server 对称用真 ProtobufFrameSerializer，Task 4 + 场景 #1/#9/#10
- ✅ In-Scope 2（client.ts:128 兼容 hack）→ 场景 #9（Task 9）+ Task 13 sanity check
- ✅ In-Scope 3（UI 回归 8 场景）→ Task 5-8 逐一迁移
- ✅ In-Scope 4（quick-call 失败）→ 场景 #5（Task 7）
- ✅ In-Scope 5（传输层异常）→ 场景 #11/#12（Task 11）
- ✅ In-Scope 6（bot-ready 有/无两种模式）→ 场景 #9 + #10
- ✅ Out of Scope → Task 15 PR 描述明列

**Placeholder scan:**
- 已扫描 — 无 TBD/TODO
- Task 7/#4 的 error 文本断言用了 `/error/i` 兜底（因 client.ts 把 `message.type` 直接 set 进 state，实际渲染看 PhoneSimulator 的 error div）；若精确失败，有明确 fallback 指引
- Task 11/#12 握手被拒路径含 fallback 指引（SDK 内部重连可能干扰）

**Type consistency:**
- `FakePhoneAiServer` 接口定义（Task 4）与后续 Task 5-11 使用的方法名匹配：`awaitConnection` / `sendBotReady` / `sendBotTranscript` / `sendUserTranscript(text, {final})` / `sendError(msg, {fatal})` / `closeFromServer` / `isConnected` / `isClosed` / `stop` ✓

**与 spec 架构图的差异（已合理化）：**
- Spec 图：mock 只在 `global.WebSocket` 层
- 实际：额外 mock `WavMediaManager`，因 JSDOM 没有 AudioContext
- 合理性：`WavMediaManager` 是"音频 I/O"层，不是 RTVI 协议层；把它 stub 掉不破坏本 spec 的核心检验目标。Plan 顶部架构说明已写明
