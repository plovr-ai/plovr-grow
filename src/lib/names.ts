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

/**
 * Parse a full name into first and last name
 * Used for backward compatibility and data migration
 *
 * @param fullName - Full name to parse
 * @returns Object containing firstName and lastName
 *
 * @example
 * parseFullName("John Doe") // { firstName: "John", lastName: "Doe" }
 * parseFullName("Mary Jane Smith") // { firstName: "Mary", lastName: "Jane Smith" }
 * parseFullName("Madonna") // { firstName: "Madonna", lastName: "" }
 */
export function parseFullName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0 || fullName.trim() === '') {
    return { firstName: '', lastName: '' };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ');
  return { firstName, lastName };
}
