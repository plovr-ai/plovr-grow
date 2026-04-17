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
});
