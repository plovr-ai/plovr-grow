export const CALL_STATUS = {
  IDLE: "idle",
  CONNECTING: "connecting",
  CONNECTED: "connected",
  DISCONNECTED: "disconnected",
} as const;

export type CallStatus = (typeof CALL_STATUS)[keyof typeof CALL_STATUS];

export interface ConversationMessage {
  id: string;
  role: "user" | "bot";
  text: string;
  timestamp: Date;
}

export interface PlaygroundConfig {
  apiUrl: string;
}
