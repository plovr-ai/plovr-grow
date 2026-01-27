/**
 * Gift Card Number Utilities
 *
 * Format: GC-XXXX-XXXX-XXXX (12 alphanumeric characters)
 * Excludes ambiguous characters: 0, O, I, L, 1
 */

// Character set excluding ambiguous characters (0, O, I, L, 1)
const CHAR_SET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/**
 * Generate a unique gift card number
 * Format: GC-XXXX-XXXX-XXXX
 */
export function generateGiftCardNumber(): string {
  const segments: string[] = [];

  for (let i = 0; i < 3; i++) {
    let segment = "";
    for (let j = 0; j < 4; j++) {
      // Use crypto for secure random generation
      const randomBytes = new Uint8Array(1);
      crypto.getRandomValues(randomBytes);
      const randomIndex = randomBytes[0] % CHAR_SET.length;
      segment += CHAR_SET[randomIndex];
    }
    segments.push(segment);
  }

  return `GC-${segments.join("-")}`;
}

/**
 * Normalize a gift card number input
 * Removes dashes, spaces, and converts to uppercase
 * Returns the 12-character code without prefix
 */
export function normalizeGiftCardNumber(input: string): string {
  // Remove GC- prefix if present, then remove all dashes and spaces
  const cleaned = input
    .toUpperCase()
    .replace(/^GC-?/, "")
    .replace(/[-\s]/g, "");

  return cleaned;
}

/**
 * Format a normalized card number for display
 * Input: "ABCD1234EFGH" -> Output: "GC-ABCD-1234-EFGH"
 */
export function formatGiftCardNumber(normalized: string): string {
  // Remove any existing prefix
  const clean = normalized.replace(/^GC-?/, "");

  // Split into chunks of 4
  const chunks = clean.match(/.{1,4}/g) || [];

  return `GC-${chunks.join("-")}`;
}

/**
 * Validate gift card number format
 * Returns true if the format is valid (GC-XXXX-XXXX-XXXX)
 */
export function isValidGiftCardFormat(cardNumber: string): boolean {
  // Accept formats: GC-XXXX-XXXX-XXXX or XXXXXXXXXXXX
  const withPrefix = /^GC-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/i;
  const withoutPrefix = /^[A-HJ-NP-Z2-9]{12}$/i;

  return withPrefix.test(cardNumber) || withoutPrefix.test(cardNumber);
}

/**
 * Mask a gift card number for display (security)
 * GC-ABCD-1234-EFGH -> GC-****-****-EFGH
 */
export function maskGiftCardNumber(cardNumber: string): string {
  const formatted = formatGiftCardNumber(normalizeGiftCardNumber(cardNumber));
  // Show only last 4 characters
  return formatted.replace(/^GC-(.{4})-(.{4})-/, "GC-****-****-");
}
