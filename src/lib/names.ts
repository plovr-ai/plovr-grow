/**
 * Utility functions for handling customer names
 */

/**
 * Combines first and last name for display
 * @param firstName - Customer's first name
 * @param lastName - Customer's last name
 * @returns Formatted full name
 */
export function formatCustomerName(
  firstName: string,
  lastName: string
): string {
  return `${firstName} ${lastName}`.trim();
}

