import { PipecatClient } from "@pipecat-ai/client-js";
import type { TranscriptData, BotLLMTextData, RTVIMessage } from "@pipecat-ai/client-js";
import { WebSocketTransport } from "@pipecat-ai/websocket-transport";
import type { PlaygroundConfig, ConversationMessage } from "./types";

interface PipecatCallbacks {
  onStatusChange: (status: "connecting" | "connected" | "disconnected") => void;
  onMessage: (message: ConversationMessage) => void;
  onError: (error: string) => void;
}

let messageCounter = 0;

function createMessageId(): string {
  messageCounter += 1;
  return `msg-${Date.now()}-${messageCounter}`;
}

export async function startCall(
  config: PlaygroundConfig,
  callbacks: PipecatCallbacks
): Promise<PipecatClient> {
  callbacks.onStatusChange("connecting");

  // 1. Get WebSocket URL from plovr-phone-ai
  const response = await fetch(
    `${config.apiUrl}/api/ai/admin/playground/put-config`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant_id: config.tenantId,
        org_id: config.merchantId,
        agents: [],
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create call session: ${errorText}`);
  }

  const { ws_url } = (await response.json()) as { ws_url: string };

  // 2. Create transport and client
  const transport = new WebSocketTransport({ wsUrl: ws_url });
  const client = new PipecatClient({ transport });

  // 3. Wire up event listeners
  client.on("connected", () => {
    callbacks.onStatusChange("connected");
  });

  client.on("disconnected", () => {
    callbacks.onStatusChange("disconnected");
  });

  client.on("userTranscript", (data: TranscriptData) => {
    if (data.text.trim()) {
      callbacks.onMessage({
        id: createMessageId(),
        role: "user",
        text: data.text,
        timestamp: new Date(),
      });
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
  });

  // 4. Connect
  await client.connect();

  return client;
}

export async function endCall(client: PipecatClient): Promise<void> {
  await client.disconnect();
}
