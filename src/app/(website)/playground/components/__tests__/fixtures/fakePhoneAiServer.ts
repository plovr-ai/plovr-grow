import { Server, type Client } from "mock-socket";
import { ProtobufFrameSerializer } from "@pipecat-ai/websocket-transport";
import type { RTVIMessage } from "@pipecat-ai/client-js";
import {
  botReady,
  botTranscription,
  userTranscription,
  errorMessage,
} from "./rtviMessages";

// JSDOM's Blob does not implement `arrayBuffer()`; the real Pipecat
// ProtobufFrameSerializer.deserialize awaits it. Polyfill on first use so
// `blob instanceof Blob` still holds and the SDK's code path is exercised.
if (typeof Blob !== "undefined" && typeof Blob.prototype.arrayBuffer !== "function") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Blob.prototype as any).arrayBuffer = function arrayBuffer(): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this as Blob);
    });
  };
}

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
      // the same ProtobufFrameSerializer. The SDK calls ws.send(uint8Array),
      // but mock-socket's `normalizeSendData` only passes through Blob and
      // ArrayBuffer — Uint8Array becomes `String(uint8array)` (comma-joined
      // bytes). Decode either shape.
      try {
        let blob: Blob;
        if (data instanceof Blob) {
          blob = data;
        } else if (data instanceof ArrayBuffer) {
          blob = new Blob([data]);
        } else if (typeof data === "string") {
          // Uint8Array stringified by mock-socket — recover the bytes.
          const bytes = Uint8Array.from(
            data.split(",").map((s) => Number(s)),
          );
          blob = new Blob([bytes]);
        } else {
          return;
        }
        const parsed = await serializer.deserialize(blob);
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
    // SDK's ReconnectingWebSocket._handleMessage only resolves if the payload
    // is a string, ArrayBuffer, or Blob — and deserialize() requires Blob.
    // So wrap as Blob. Cast through Uint8Array so `BlobPart` typing is happy
    // across Uint8Array<ArrayBufferLike> variants.
    const blob = new Blob([encoded as unknown as ArrayBuffer]);
    connectedClient.send(blob);
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
