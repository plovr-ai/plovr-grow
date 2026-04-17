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
