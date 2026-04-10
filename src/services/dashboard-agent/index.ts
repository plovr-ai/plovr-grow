/**
 * Dashboard Agent Service
 *
 * Conversational AI agent for the dashboard.
 * Handles user messages, intent classification, and tool execution.
 */

export {
  DashboardAgentService,
  dashboardAgentService,
} from "./dashboard-agent.service";

export type {
  // Message types
  Message,
  MessageContent,
  MessageContentType,
  MessageRole,
  ToolCallContent,
  ToolResultContent,
  ProgressContent,
  QuickAction,
  // Conversation types
  ConversationContext,
  // Intent types
  IntentCategory,
  IntentResult,
  // API types
  SendMessageRequest,
  SendMessageResponse,
  StreamEvent,
  StreamEventType,
  // Tool types
  ToolDefinition,
  ToolParameter,
  ToolParameterType,
  ToolExecutionContext,
  ToolValidationResult,
} from "./dashboard-agent.types";

// Export tool registry for extensibility
export { toolRegistry } from "./tools";
export type { Tool, BaseTool } from "./tools";

// Export intent classifier
export { intentClassifier } from "./intent";
