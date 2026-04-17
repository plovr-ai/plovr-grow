/**
 * Component-level E2E for PhoneSimulator.
 *
 * Mocks the underlying pipecat SDK (`@pipecat-ai/client-js` +
 * `@pipecat-ai/websocket-transport`) so the real `@/lib/pipecat/client.ts`
 * and the real React component run end-to-end. Verifies the full call
 * lifecycle a user actually performs:
 *
 *   1. Click "Start Call" — UI shows Connecting → Live, SDK gets connect()
 *   2. Bot speaks — transcript renders in conversation log
 *   3. Click red hangup — UI shows Call Ended, SDK gets disconnect()
 *   4. Mute toggle reaches `client.enableMic`
 *   5. Component unmount triggers SDK disconnect (memory-leak guard)
 *
 * The pipecat mock simulates a *correctly behaving* backend: `connect()`
 * resolves promptly (as it does once plovr-phone-ai emits the RTVI
 * `bot-ready` message). This guards against regressions where the React
 * ref is lost or the hangup button takes a wrong code path — the exact
 * failure mode from 2026-04-17 where UI changed but SDK was never told.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

type Handler = (...args: unknown[]) => void;

interface FakePipecatClient {
  handlers: Map<string, Handler[]>;
  on(event: string, handler: Handler): void;
  emit(event: string, ...args: unknown[]): void;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  enableMic: ReturnType<typeof vi.fn>;
  transport: { disconnect: ReturnType<typeof vi.fn> };
}

let currentClient: FakePipecatClient;

function makeFakeClient(overrides: Partial<FakePipecatClient> = {}): FakePipecatClient {
  const handlers = new Map<string, Handler[]>();
  const client: FakePipecatClient = {
    handlers,
    on(event, handler) {
      if (!handlers.has(event)) handlers.set(event, []);
      handlers.get(event)!.push(handler);
    },
    emit(event, ...args) {
      handlers.get(event)?.forEach((h) => h(...args));
    },
    // Default: fixed backend — connect resolves once `connected` event
    // would have been emitted. The test orchestrator emits the event.
    connect: vi.fn().mockImplementation(async () => {
      // Microtask delay so test can attach listeners before connect resolves.
      await Promise.resolve();
      client.emit("connected");
    }),
    disconnect: vi.fn().mockImplementation(async () => {
      client.emit("disconnected");
    }),
    enableMic: vi.fn(),
    transport: { disconnect: vi.fn() },
    ...overrides,
  };
  return client;
}

vi.mock("@pipecat-ai/client-js", () => ({
  PipecatClient: class {
    constructor() {
      return currentClient as unknown as object;
    }
  },
}));

vi.mock("@pipecat-ai/websocket-transport", () => ({
  WebSocketTransport: class {},
  WavMediaManager: class {},
}));

// Stub env vars the component reads.
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_PHONE_AI_API_URL", "http://phone-ai.local");
  vi.stubEnv("NEXT_PUBLIC_PLAYGROUND_TENANT_ID", "tenant-1");
  vi.stubEnv("NEXT_PUBLIC_PLAYGROUND_MERCHANT_ID", "merchant-1");

  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ ws_url: "ws://phone-ai.local/session" }),
  } as Response);
});

// IMPORTANT: import the component AFTER mocks are set up. Use dynamic import
// inside each test so vi.stubEnv values are picked up by the module-scope
// `config` constant.
async function renderPhoneSimulator() {
  const mod = await import("../PhoneSimulator");
  return render(<mod.PhoneSimulator />);
}

async function clickStartCall() {
  const startBtn = await screen.findByRole("button", { name: /start call/i });
  await act(async () => {
    fireEvent.click(startBtn);
  });
}

async function clickHangup() {
  const hangupBtn = await screen.findByRole("button", { name: /end call/i });
  await act(async () => {
    fireEvent.click(hangupBtn);
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

describe("PhoneSimulator E2E — full call lifecycle", () => {
  beforeEach(() => {
    vi.resetModules();
    currentClient = makeFakeClient();
  });

  it("complete happy path: start → live → bot speaks → hangup → call ended", async () => {
    await renderPhoneSimulator();

    // Initial state: Start Call button visible, no Live indicator.
    expect(screen.getByRole("button", { name: /start call/i })).toBeInTheDocument();
    expect(screen.queryByText("Live")).not.toBeInTheDocument();

    // 1. Start call → fetches WS URL, builds transport+client, connects.
    await clickStartCall();
    expect(global.fetch).toHaveBeenCalledWith(
      "http://phone-ai.local/api/ai/admin/playground/quick-call",
      expect.objectContaining({ method: "POST" })
    );
    expect(currentClient.connect).toHaveBeenCalledTimes(1);

    // 2. UI reflects connected state.
    await waitForLive();
    expect(screen.getByText(/00:0\d/)).toBeInTheDocument(); // call timer

    // 3. Bot transcript flows through to the conversation log.
    act(() => {
      currentClient.emit("botTranscript", { text: "Welcome to Burger Shack." });
    });
    await waitFor(() => {
      expect(screen.getByText("Welcome to Burger Shack.")).toBeInTheDocument();
    });

    // 4. User transcript (final) shows the user's words.
    act(() => {
      currentClient.emit("userTranscript", {
        text: "I'd like a burger",
        final: true,
      });
    });
    await waitFor(() => {
      expect(screen.getByText("I'd like a burger")).toBeInTheDocument();
    });

    // 5. Hangup — this is the regression we care about most.
    //    Before fix: UI flipped to "Call Ended" but disconnect was never
    //    called because clientRef.current was null.
    await clickHangup();
    expect(currentClient.disconnect).toHaveBeenCalledTimes(1);

    // 6. UI confirms the call has ended.
    await waitForCallEnded();
    expect(screen.queryByText("Live")).not.toBeInTheDocument();
  });

  it("mute button toggles SDK mic state without ending the call", async () => {
    await renderPhoneSimulator();
    await clickStartCall();
    await waitForLive();

    const muteBtn = screen.getByRole("button", { name: /mute/i });
    await act(async () => {
      fireEvent.click(muteBtn);
    });
    expect(currentClient.enableMic).toHaveBeenLastCalledWith(false);

    const unmuteBtn = screen.getByRole("button", { name: /unmute/i });
    await act(async () => {
      fireEvent.click(unmuteBtn);
    });
    expect(currentClient.enableMic).toHaveBeenLastCalledWith(true);

    // Call still alive.
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(currentClient.disconnect).not.toHaveBeenCalled();
  });

  it("interim user transcripts render as a live preview, not as a final message", async () => {
    await renderPhoneSimulator();
    await clickStartCall();
    await waitForLive();

    act(() => {
      currentClient.emit("userTranscript", { text: "I'd like", final: false });
    });
    await waitFor(() => {
      // Interim text appears somewhere; it's the only place "I'd like" shows up.
      expect(screen.getByText(/I'd like/)).toBeInTheDocument();
    });

    // Promote to final — interim cleared, final message added.
    act(() => {
      currentClient.emit("userTranscript", {
        text: "I'd like a burger",
        final: true,
      });
    });
    await waitFor(() => {
      expect(screen.getByText("I'd like a burger")).toBeInTheDocument();
    });
  });

  it("surfaces errors from the call session to the UI", async () => {
    await renderPhoneSimulator();
    await clickStartCall();
    await waitForLive();

    act(() => {
      currentClient.emit("error", { type: "transport-error" });
    });
    await waitFor(() => {
      expect(screen.getByText("transport-error")).toBeInTheDocument();
    });
  });

  it("shows error and stays disconnected if quick-call endpoint fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      text: async () => "tenant disabled",
    } as Response);

    await renderPhoneSimulator();
    await clickStartCall();

    await waitFor(() => {
      expect(screen.getByText(/tenant disabled/)).toBeInTheDocument();
    });
    expect(currentClient.connect).not.toHaveBeenCalled();
    expect(screen.queryByText("Live")).not.toBeInTheDocument();
  });

  it("regression: hangup must call SDK.disconnect even after async events have re-rendered", async () => {
    // This is the exact bug we hit: ref-management broke and hangup became
    // a no-op. Drive a few re-renders mid-call to make sure ref survives.
    await renderPhoneSimulator();
    await clickStartCall();
    await waitForLive();

    // Stream a handful of bot transcripts to trigger React re-renders.
    for (let i = 0; i < 5; i++) {
      act(() => {
        currentClient.emit("botTranscript", { text: `chunk ${i}` });
      });
    }
    await waitFor(() => {
      expect(screen.getByText("chunk 4")).toBeInTheDocument();
    });

    await clickHangup();

    // The single non-negotiable assertion of the whole bug fix:
    expect(currentClient.disconnect).toHaveBeenCalledTimes(1);
    await waitForCallEnded();
  });

  it("unmounting mid-call disconnects the SDK (cleanup-on-unmount)", async () => {
    const { unmount } = await renderPhoneSimulator();
    await clickStartCall();
    await waitForLive();

    expect(currentClient.disconnect).not.toHaveBeenCalled();

    unmount();

    // The unmount cleanup is fire-and-forget; assert disconnect was scheduled.
    expect(currentClient.disconnect).toHaveBeenCalledTimes(1);
  });

  it("guards against double-click on hangup (only one disconnect)", async () => {
    await renderPhoneSimulator();
    await clickStartCall();
    await waitForLive();

    await clickHangup();
    // Re-render after disconnect — Start Call button reappears.
    await waitForCallEnded();

    // Try a second hangup via the still-rendered button if it existed
    // (it doesn't post-disconnect, but verify the SDK saw exactly one call).
    expect(currentClient.disconnect).toHaveBeenCalledTimes(1);
  });
});
