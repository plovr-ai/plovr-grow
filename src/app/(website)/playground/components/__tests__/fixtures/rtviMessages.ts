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
