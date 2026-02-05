import type { Tool } from "./tool.interface";
import type { ToolDefinition } from "../dashboard-agent.types";

/**
 * Central registry for Dashboard Agent tools.
 *
 * Tools can be registered and discovered based on keywords in user messages.
 */
class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  /**
   * Register a tool
   * @param tool - Tool instance to register
   */
  register(tool: Tool): void {
    if (this.tools.has(tool.definition.id)) {
      console.warn(
        `Tool ${tool.definition.id} already registered, overwriting`
      );
    }
    this.tools.set(tool.definition.id, tool);
  }

  /**
   * Unregister a tool
   * @param toolId - Tool ID to unregister
   */
  unregister(toolId: string): void {
    this.tools.delete(toolId);
  }

  /**
   * Get a tool by ID
   * @param toolId - Tool ID
   * @returns Tool instance or undefined
   */
  get(toolId: string): Tool | undefined {
    return this.tools.get(toolId);
  }

  /**
   * Get all registered tools
   * @returns Array of all tools
   */
  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get all tool definitions (metadata only)
   * @returns Array of tool definitions
   */
  getDefinitions(): ToolDefinition[] {
    return this.getAll().map((t) => t.definition);
  }

  /**
   * Find tools matching keywords in user message
   * @param message - User message to search
   * @returns Array of matching tools, sorted by relevance
   */
  findRelevantTools(message: string): Tool[] {
    const lowercaseMessage = message.toLowerCase();

    const toolScores = this.getAll()
      .map((tool) => {
        // Count how many keywords match
        const matchCount = tool.definition.triggerKeywords.filter((keyword) =>
          lowercaseMessage.includes(keyword.toLowerCase())
        ).length;

        return { tool, matchCount };
      })
      .filter(({ matchCount }) => matchCount > 0)
      .sort((a, b) => b.matchCount - a.matchCount);

    return toolScores.map(({ tool }) => tool);
  }

  /**
   * Check if any tool matches the message
   * @param message - User message
   * @returns True if at least one tool matches
   */
  hasMatchingTool(message: string): boolean {
    return this.findRelevantTools(message).length > 0;
  }

  /**
   * Clear all registered tools (useful for testing)
   */
  clear(): void {
    this.tools.clear();
  }
}

// Singleton instance
export const toolRegistry = new ToolRegistry();
