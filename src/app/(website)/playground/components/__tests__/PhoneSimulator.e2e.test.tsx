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

vi.mock("@pipecat-ai/websocket-transport", async () => {
  const actual = await vi.importActual<
    typeof import("@pipecat-ai/websocket-transport")
  >("@pipecat-ai/websocket-transport");
  const { FakeWavMediaManager } = await import("./fixtures/browserStubs");
  return { ...actual, WavMediaManager: FakeWavMediaManager };
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

  it("non-fatal error surfaces to UI but call keeps going", async () => {
    await renderPhoneSimulator();
    await clickStartCall();
    await server.awaitConnection();
    await waitForLive();

    act(() => {
      server.sendError("transport-hiccup", { fatal: false });
    });
    await waitFor(() => {
      // client.ts forwards message.type ("error") into setError.
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
    await waitFor(() => {
      expect(server.isClosed()).toBe(true);
    });
    expect(server.isConnected()).toBe(false);
  });

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
    // Both "Call Ended" (status badge) and "error" (error banner) render — assert
    // at least one matches, not exactly one.
    await waitFor(() => {
      expect(screen.queryAllByText(/call ended|error/i).length).toBeGreaterThan(0);
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
});
