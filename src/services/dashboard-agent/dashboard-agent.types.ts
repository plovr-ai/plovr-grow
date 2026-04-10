// ==================== Message Types ====================

export type MessageRole = "user" | "assistant" | "system";

export type MessageContentType =
  | "text"
  | "tool_call"
  | "tool_result"
  | "quick_actions"
  | "progress";

export interface ToolCallContent {
  toolId: string;
  toolName: string;
  arguments: Record<string, unknown>;
}

export interface ToolResultContent {
  toolId: string;
  toolName: string;
  success: boolean;
  data?: unknown;
  error?: string;
  /** UI component to render (e.g., "menu-import-result", "order-list") */
  renderAs?: string;
}

export interface ProgressContent {
  stage: string;
  progress: number; // 0-100
  message: string;
}

export interface QuickAction {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  /** Action to execute when clicked */
  action: {
    type: "send_message" | "navigate" | "execute_tool";
    payload: string | Record<string, unknown>;
  };
}

export interface MessageContent {
  type: MessageContentType;
  text?: string;
  toolCall?: ToolCallContent;
  toolResult?: ToolResultContent;
  quickActions?: QuickAction[];
  progress?: ProgressContent;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: MessageContent[];
  createdAt: Date;
  /** For assistant messages, track if still streaming */
  isStreaming?: boolean;
}

// ==================== Conversation Types ====================

export interface SubscriptionContext {
  status: string;
  canAccessPremiumFeatures: boolean;
  isTrialing: boolean;
  trialDaysRemaining: number | null;
}

export interface ConversationContext {
  /** Current active intent/topic */
  activeIntent?: IntentResult;
  /** Entity slots collected during conversation */
  slots: Record<string, unknown>;
  /** Subscription status */
  subscription?: SubscriptionContext;
}

// ==================== Intent Types ====================

export type IntentCategory =
  | "subscription"
  | "menu_management"
  | "order_management"
  | "reports"
  | "settings"
  | "general_help"
  | "unknown";

export interface IntentResult {
  category: IntentCategory;
  /** Specific action within the category */
  action: string;
  confidence: number;
  /** Extracted entities from user message */
  entities: Record<string, unknown>;
}

// ==================== API Types ====================

export interface SendMessageRequest {
  message: string;
  conversationId?: string;
  /** Optional: include current context for server-side processing */
  context?: Partial<ConversationContext>;
}

export interface SendMessageResponse {
  conversationId: string;
  message: Message;
  /** Updated context after processing */
  context: ConversationContext;
}

export type StreamEventType =
  | "text"
  | "tool_start"
  | "tool_end"
  | "progress"
  | "quick_actions"
  | "context_update"
  | "done"
  | "error";

export interface StreamEvent {
  type: StreamEventType;
  data: unknown;
}

// ==================== Tool Types ====================

export type ToolParameterType = "string" | "number" | "boolean" | "array" | "object";

export interface ToolParameter {
  name: string;
  type: ToolParameterType;
  description: string;
  required: boolean;
  enum?: string[];
}

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  /** Keywords that trigger this tool */
  triggerKeywords: string[];
  parameters: ToolParameter[];
  /** Required permissions */
  permissions?: string[];
}

export interface ToolExecutionContext {
  tenantId: string;
  companyId: string;
  merchantId: string;
  userId: string;
  conversationContext: ConversationContext;
}

export interface ToolValidationResult {
  valid: boolean;
  errors?: string[];
}

