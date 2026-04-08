/**
 * Centralized ID generation utilities
 * All entity IDs should use these functions for consistency
 */

/**
 * Generate a unique entity ID (UUID v4)
 * Used for all database entity primary keys
 */
export function generateEntityId(): string {
  return crypto.randomUUID();
}

