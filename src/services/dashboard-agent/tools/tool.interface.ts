import type {
  ToolDefinition,
  ToolExecutionContext,
  ToolResultContent,
  ToolValidationResult,
} from "../dashboard-agent.types";

/**
 * Interface for Dashboard Agent tools.
 *
 * Tools are capabilities that the agent can execute in response to user requests.
 * Each tool has a definition (metadata) and an execute method.
 */
export interface Tool {
  /** Tool metadata including id, name, and trigger keywords */
  definition: ToolDefinition;

  /**
   * Execute the tool with given arguments
   * @param args - Tool arguments extracted from user message
   * @param context - Execution context including tenant, company, merchant info
   * @returns Tool result with success status and data
   */
  execute(
    args: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResultContent>;

  /**
   * Validate arguments before execution
   * @param args - Arguments to validate
   * @returns Validation result with errors if invalid
   */
  validateArgs(args: Record<string, unknown>): ToolValidationResult;
}

/**
 * Abstract base class for tools with common validation logic
 */
export abstract class BaseTool implements Tool {
  abstract definition: ToolDefinition;

  abstract execute(
    args: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResultContent>;

  validateArgs(args: Record<string, unknown>): ToolValidationResult {
    const errors: string[] = [];

    for (const param of this.definition.parameters) {
      const value = args[param.name];

      // Check required parameters
      if (param.required && (value === undefined || value === null || value === "")) {
        errors.push(`Missing required parameter: ${param.name}`);
        continue;
      }

      // Skip validation for optional empty values
      if (value === undefined || value === null || value === "") {
        continue;
      }

      // Type validation
      const actualType = Array.isArray(value) ? "array" : typeof value;
      if (actualType !== param.type) {
        errors.push(
          `Invalid type for ${param.name}: expected ${param.type}, got ${actualType}`
        );
      }

      // Enum validation
      if (param.enum && !param.enum.includes(value as string)) {
        errors.push(
          `Invalid value for ${param.name}: must be one of ${param.enum.join(", ")}`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}
