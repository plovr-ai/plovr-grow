/**
 * Dashboard Agent Tools
 *
 * This module exports the tool registry and all available tools.
 * Tools are automatically registered when this module is imported.
 */

import { toolRegistry } from "./tool-registry";
import { subscriptionTool } from "./subscription.tool";

// Register all tools
toolRegistry.register(subscriptionTool);

// Export registry and utilities
export { toolRegistry } from "./tool-registry";
export type { Tool, BaseTool } from "./tool.interface";
