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

/**
 * Generate a CUID (for compatibility with legacy FeaturedItem)
 * @deprecated Use generateEntityId() for new entities
 */
export function generateCuid(): string {
  // For now, delegate to UUID for consistency
  // In future, can use `cuid()` library if needed
  return crypto.randomUUID();
}
