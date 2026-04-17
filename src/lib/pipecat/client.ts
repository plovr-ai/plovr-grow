import { PipecatClient } from "@pipecat-ai/client-js";
import type { TranscriptData, BotLLMTextData, RTVIMessage } from "@pipecat-ai/client-js";
import { WebSocketTransport, WavMediaManager } from "@pipecat-ai/websocket-transport";
import type { PlaygroundConfig, ConversationMessage } from "./types";

interface PipecatCallbacks {
  onStatusChange: (status: "connecting" | "connected" | "disconnected") => void;
  onMessage: (message: ConversationMessage) => void;
  onInterimTranscript: (text: string | null) => void;
  onError: (error: string) => void;
}

export interface CallHandle {
  client: PipecatClient;
  end: () => Promise<void>;
}

let messageCounter = 0;

function createMessageId(): string {
  messageCounter += 1;
  return `msg-${Date.now()}-${messageCounter}`;
}

export async function startCall(
  config: PlaygroundConfig,
  callbacks: PipecatCallbacks
): Promise<CallHandle> {
  callbacks.onStatusChange("connecting");

  const response = await fetch(
    `${config.apiUrl}/api/ai/admin/playground/quick-call`,
    {
      method: "POST",
      headers: {
        "sec-plovr-user": "playground",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tenantId: config.tenantId,
        merchantId: config.merchantId,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create call session: ${errorText}`);
  }

  const { ws_url } = (await response.json()) as { ws_url: string };

  // DailyMediaManager (the default) leaves the mic MediaStreamTrack running
  // on disconnect — MediaStreamRecorder.end() doesn't call track.stop() and
  // _daily.leave() isn't awaited, so the browser mic indicator stays on.
  // WavMediaManager uses getUserMedia directly and its WavRecorder.end()
  // explicitly stops tracks.
  const transport = new WebSocketTransport({
    wsUrl: ws_url,
    mediaManager: new WavMediaManager(),
  });
  const client = new PipecatClient({ transport });

  let isDisposed = false;
  const dispose = async (): Promise<void> => {
    if (isDisposed) return;
    isDisposed = true;

    const timeoutMs = 3000;
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
    try {
      await Promise.race([client.disconnect(), timeout]);
    } catch {
      // SDK may throw if WS/media already closed; best-effort cleanup
    }

    callbacks.onStatusChange("disconnected");
  };

  client.on("connected", () => {
    callbacks.onStatusChange("connected");
  });

  client.on("disconnected", () => {
    callbacks.onStatusChange("disconnected");
  });

  client.on("userTranscript", (data: TranscriptData) => {
    if (!data.text.trim()) return;

    if (data.final) {
      callbacks.onInterimTranscript(null);
      callbacks.onMessage({
        id: createMessageId(),
        role: "user",
        text: data.text,
        timestamp: new Date(),
      });
    } else {
      callbacks.onInterimTranscript(data.text);
    }
  });

  client.on("botTranscript", (data: BotLLMTextData) => {
    if (data.text.trim()) {
      callbacks.onMessage({
        id: createMessageId(),
        role: "bot",
        text: data.text,
        timestamp: new Date(),
      });
    }
  });

  client.on("error", (message: RTVIMessage) => {
    callbacks.onError(message.type);
    const data = (message as unknown as { data?: { fatal?: boolean } }).data;
    if (data?.fatal) {
      void dispose();
    }
  });

  // client.connect() only resolves on the RTVI `bot-ready` message. Our
  // plovr-phone-ai backend doesn't send that, so the promise would hang
  // forever even though the WebSocket is fully usable. Resolve on the
  // `connected` event instead, which fires as soon as the WS handshake
  // completes.
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    client.on("connected", () => {
      if (settled) return;
      settled = true;
      resolve();
    });
    client.on("error", (message: RTVIMessage) => {
      const data = (message as unknown as { data?: { fatal?: boolean } }).data;
      if (!data?.fatal || settled) return;
      settled = true;
      reject(new Error(`pipecat error: ${message.type}`));
    });
    client.connect().catch((err) => {
      if (settled) return;
      settled = true;
      reject(err);
    });
  });

  return { client, end: dispose };
}

export async function endCall(handle: CallHandle): Promise<void> {
  await handle.end();
}
