import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type Handler = (...args: unknown[]) => void;

interface FakeClient {
  handlers: Map<string, Handler[]>;
  on(event: string, handler: Handler): void;
  emit(event: string, ...args: unknown[]): void;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  enableMic: ReturnType<typeof vi.fn>;
}

let currentFakeClient: FakeClient;

function makeFakeClient(connect: () => Promise<unknown>): FakeClient {
  const handlers = new Map<string, Handler[]>();
  return {
    handlers,
    on(event, handler) {
      if (!handlers.has(event)) handlers.set(event, []);
      handlers.get(event)!.push(handler);
    },
    emit(event, ...args) {
      handlers.get(event)?.forEach((h) => h(...args));
    },
    connect: vi.fn(connect),
    disconnect: vi.fn().mockResolvedValue(undefined),
    enableMic: vi.fn(),
  };
}

vi.mock("@pipecat-ai/client-js", () => ({
  PipecatClient: class {
    constructor() {
      return currentFakeClient as unknown as object;
    }
  },
}));

vi.mock("@pipecat-ai/websocket-transport", () => ({
  WebSocketTransport: class {},
  WavMediaManager: class {},
}));

import { startCall, endCall } from "../client";

const config = {
  apiUrl: "http://phone-ai.local",
  tenantId: "tenant-1",
  merchantId: "merchant-1",
};

function makeCallbacks() {
  return {
    onStatusChange: vi.fn(),
    onMessage: vi.fn(),
    onInterimTranscript: vi.fn(),
    onError: vi.fn(),
  };
}

function mockQuickCallOk(): void {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ ws_url: "ws://phone-ai.local/session" }),
  } as Response);
}

describe("startCall", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuickCallOk();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves once the `connected` event fires, even if client.connect() never resolves (missing RTVI bot-ready)", async () => {
    // Simulate plovr-phone-ai backend: ws is live but no bot-ready ever arrives,
    // so the SDK's connect() promise hangs forever.
    currentFakeClient = makeFakeClient(() => new Promise(() => {}));

    const callbacks = makeCallbacks();
    const startPromise = startCall(config, callbacks);

    // Let the async chain advance past fetch + PipecatClient construction.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // Fire the `connected` event the transport emits after the WS handshake.
    currentFakeClient.emit("connected");

    const handle = await startPromise;
    expect(handle.client).toBe(currentFakeClient);
    expect(typeof handle.end).toBe("function");
  });

  it("reports status transitions through callbacks", async () => {
    currentFakeClient = makeFakeClient(() => new Promise(() => {}));
    const callbacks = makeCallbacks();

    const startPromise = startCall(config, callbacks);
    expect(callbacks.onStatusChange).toHaveBeenCalledWith("connecting");

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    currentFakeClient.emit("connected");

    await startPromise;
    expect(callbacks.onStatusChange).toHaveBeenCalledWith("connected");
  });

  it("rejects when client.connect() throws before the connected event", async () => {
    currentFakeClient = makeFakeClient(() =>
      Promise.reject(new Error("transport failure"))
    );

    const callbacks = makeCallbacks();
    await expect(startCall(config, callbacks)).rejects.toThrow("transport failure");
  });

  it("rejects when a fatal error is emitted before connect completes", async () => {
    currentFakeClient = makeFakeClient(() => new Promise(() => {}));
    const callbacks = makeCallbacks();

    const startPromise = startCall(config, callbacks);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    currentFakeClient.emit("error", { type: "boom", data: { fatal: true } });

    await expect(startPromise).rejects.toThrow("pipecat error: boom");
  });

  it("ignores non-fatal errors while waiting for connected", async () => {
    currentFakeClient = makeFakeClient(() => new Promise(() => {}));
    const callbacks = makeCallbacks();

    const startPromise = startCall(config, callbacks);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    currentFakeClient.emit("error", { type: "transient", data: { fatal: false } });
    // Should NOT reject. Once connected fires, startCall resolves.
    currentFakeClient.emit("connected");

    const handle = await startPromise;
    expect(handle).toBeDefined();
  });

  it("throws if quick-call endpoint fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      text: async () => "tenant not found",
    } as Response);
    currentFakeClient = makeFakeClient(() => Promise.resolve());

    const callbacks = makeCallbacks();
    await expect(startCall(config, callbacks)).rejects.toThrow(/tenant not found/);
  });

  it("forwards user transcripts to callbacks.onMessage with role=user on final chunks", async () => {
    currentFakeClient = makeFakeClient(() => new Promise(() => {}));
    const callbacks = makeCallbacks();

    const startPromise = startCall(config, callbacks);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    currentFakeClient.emit("connected");
    await startPromise;

    currentFakeClient.emit("userTranscript", { text: "hello", final: true });
    expect(callbacks.onMessage).toHaveBeenCalledWith(
      expect.objectContaining({ role: "user", text: "hello" })
    );
    expect(callbacks.onInterimTranscript).toHaveBeenCalledWith(null);
  });

  it("surfaces interim transcripts via onInterimTranscript when not final", async () => {
    currentFakeClient = makeFakeClient(() => new Promise(() => {}));
    const callbacks = makeCallbacks();

    const startPromise = startCall(config, callbacks);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    currentFakeClient.emit("connected");
    await startPromise;

    currentFakeClient.emit("userTranscript", { text: "hel", final: false });
    expect(callbacks.onInterimTranscript).toHaveBeenCalledWith("hel");
    expect(callbacks.onMessage).not.toHaveBeenCalled();
  });

  it("forwards bot transcripts", async () => {
    currentFakeClient = makeFakeClient(() => new Promise(() => {}));
    const callbacks = makeCallbacks();

    const startPromise = startCall(config, callbacks);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    currentFakeClient.emit("connected");
    await startPromise;

    currentFakeClient.emit("botTranscript", { text: "welcome to Burger Shack" });
    expect(callbacks.onMessage).toHaveBeenCalledWith(
      expect.objectContaining({ role: "bot", text: "welcome to Burger Shack" })
    );
  });
});

describe("endCall / dispose", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuickCallOk();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function startConnectedCall() {
    currentFakeClient = makeFakeClient(() => new Promise(() => {}));
    const callbacks = makeCallbacks();
    const startPromise = startCall(config, callbacks);

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    currentFakeClient.emit("connected");

    const handle = await startPromise;
    return { handle, callbacks };
  }

  it("disconnects the underlying pipecat client", async () => {
    const { handle } = await startConnectedCall();

    await endCall(handle);

    expect(currentFakeClient.disconnect).toHaveBeenCalledTimes(1);
  });

  it("is idempotent — calling end() twice only disconnects once", async () => {
    const { handle } = await startConnectedCall();

    await endCall(handle);
    await endCall(handle);

    expect(currentFakeClient.disconnect).toHaveBeenCalledTimes(1);
  });

  it("notifies onStatusChange with 'disconnected' after disposal", async () => {
    const { handle, callbacks } = await startConnectedCall();
    callbacks.onStatusChange.mockClear();

    await endCall(handle);

    expect(callbacks.onStatusChange).toHaveBeenCalledWith("disconnected");
  });

  it("resolves within the timeout even if client.disconnect() hangs", async () => {
    vi.useFakeTimers();
    const { handle } = await startConnectedCall();
    // Replace disconnect with one that never resolves.
    currentFakeClient.disconnect.mockImplementation(() => new Promise(() => {}));

    const endPromise = endCall(handle);
    await vi.advanceTimersByTimeAsync(3000);

    await expect(endPromise).resolves.toBeUndefined();
  });

  it("auto-disposes when a fatal error is emitted after connect", async () => {
    const { handle } = await startConnectedCall();

    currentFakeClient.emit("error", { type: "boom", data: { fatal: true } });
    // Give the async dispose chain a tick.
    await Promise.resolve();
    await Promise.resolve();

    expect(currentFakeClient.disconnect).toHaveBeenCalledTimes(1);

    // A follow-up explicit end() must stay idempotent.
    await endCall(handle);
    expect(currentFakeClient.disconnect).toHaveBeenCalledTimes(1);
  });

  it("does NOT auto-dispose on non-fatal errors", async () => {
    const { handle: _handle } = await startConnectedCall();

    currentFakeClient.emit("error", { type: "transient", data: { fatal: false } });
    await Promise.resolve();

    expect(currentFakeClient.disconnect).not.toHaveBeenCalled();
  });
});
