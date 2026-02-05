/**
 * Dashboard Agent Tools
 *
 * This module exports the tool registry and all available tools.
 * Tools are automatically registered when this module is imported.
 */

import { toolRegistry } from "./tool-registry";
import { onboardingTool } from "./onboarding.tool";

// Register all tools
toolRegistry.register(onboardingTool);

// Export registry and utilities
export { toolRegistry } from "./tool-registry";
export { extractUrlsFromMessage } from "./onboarding.tool";
export type { Tool, BaseTool } from "./tool.interface";
