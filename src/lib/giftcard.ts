/**
 * Gift Card Number Utilities
 *
 * Format: XXXX-XXXX-XXXX-XXXX (16 digits)
 */

const CHAR_SET = "0123456789";

/**
 * Generate a unique gift card number
 * Format: XXXX-XXXX-XXXX-XXXX (16 digits)
 */
export function generateGiftCardNumber(): string {
  const segments: string[] = [];

  for (let i = 0; i < 4; i++) {
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

  return segments.join("-");
}

/**
 * Normalize a gift card number input
 * Removes dashes and spaces
 * Returns the 16-digit code
 */
export function normalizeGiftCardNumber(input: string): string {
  return input.replace(/[-\s]/g, "");
}

/**
 * Format a normalized card number for display
 * Input: "1234567890123456" -> Output: "1234-5678-9012-3456"
 */
export function formatGiftCardNumber(normalized: string): string {
  // Remove any existing dashes
  const clean = normalized.replace(/-/g, "");

  // Split into chunks of 4
  const chunks = clean.match(/.{1,4}/g) || [];

  return chunks.join("-");
}

/**
 * Validate gift card number format
 * Returns true if the format is valid (XXXX-XXXX-XXXX-XXXX or 16 digits)
 */
export function isValidGiftCardFormat(cardNumber: string): boolean {
  // Accept formats: XXXX-XXXX-XXXX-XXXX or 16 digits
  const withDashes = /^\d{4}-\d{4}-\d{4}-\d{4}$/;
  const withoutDashes = /^\d{16}$/;

  return withDashes.test(cardNumber) || withoutDashes.test(cardNumber);
}

