import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { getTodayInTimezone } from "@/lib/timezone";

/**
 * Merge Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format price for display with currency and locale support
 */
export function formatPrice(
  price: number | string,
  currency = "USD",
  locale = "en-US"
): string {
  const numPrice = typeof price === "string" ? parseFloat(price) : price;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(numPrice);
}

/**
 * Generate a human-readable order number
 * Format: YYYYMMDD-XXXX (e.g., 20240115-0042)
 * @param sequence - Order sequence number for the day
 * @param timezone - IANA timezone (e.g., "America/New_York"). Defaults to UTC for backward compatibility.
 */
export function generateOrderNumber(sequence: number, timezone?: string): string {
  const dateStr = timezone
    ? getTodayInTimezone(timezone).replace(/-/g, "")
    : new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const seqStr = sequence.toString().padStart(4, "0");
  return `${dateStr}-${seqStr}`;
}

/**
 * Generate a catering order number
 * Format: CTR-YYYYMMDD-XXXX (e.g., CTR-20240115-0001)
 * @param sequence - Order sequence number for the day
 * @param timezone - IANA timezone (e.g., "America/New_York"). Defaults to UTC for backward compatibility.
 */
export function generateCateringOrderNumber(sequence: number, timezone?: string): string {
  const dateStr = timezone
    ? getTodayInTimezone(timezone).replace(/-/g, "")
    : new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const seqStr = sequence.toString().padStart(4, "0");
  return `CTR-${dateStr}-${seqStr}`;
}

/**
 * Generate a giftcard order number
 * Format: GC-YYYYMMDD-XXXX (e.g., GC-20240115-0001)
 * @param sequence - Order sequence number for the day
 * @param timezone - IANA timezone (e.g., "America/New_York"). Defaults to UTC for backward compatibility.
 */
export function generateGiftcardOrderNumber(sequence: number, timezone?: string): string {
  const dateStr = timezone
    ? getTodayInTimezone(timezone).replace(/-/g, "")
    : new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const seqStr = sequence.toString().padStart(4, "0");
  return `GC-${dateStr}-${seqStr}`;
}

/**
 * Generate an invoice number
 * Format: INV-XXXXXX (e.g., INV-000001)
 */
export function generateInvoiceNumber(sequence: number): string {
  const seqStr = sequence.toString().padStart(6, "0");
  return `INV-${seqStr}`;
}

/**
 * Calculate tax amount
 */
export function calculateTax(subtotal: number, taxRate: number): number {
  return Math.round(subtotal * taxRate * 100) / 100;
}

/**
 * Sleep utility for async operations
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Safely parse JSON with a fallback
 */
export function safeJsonParse<T>(
  json: string | null | undefined,
  fallback: T
): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Format phone number based on locale
 * For US locale: (555) 123-4567
 * For other locales: returns original format
 */
export function formatPhone(phone: string, locale = "en-US"): string {
  // Remove all non-digit characters except leading +
  const cleaned = phone.replace(/[^\d+]/g, "");

  // US format: (XXX) XXX-XXXX
  if (locale.startsWith("en-US") || locale === "en") {
    // Handle 10-digit US numbers (with optional +1 prefix)
    const match = cleaned.match(/^(\+?1)?(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return `(${match[2]}) ${match[3]}-${match[4]}`;
    }
  }

  // For other locales or unparseable numbers, return original
  return phone;
}

/**
 * Format phone input progressively as user types
 * Handles both typing and deletion gracefully
 * For US locale: (XXX) XXX-XXXX
 */
export function formatPhoneInput(value: string, locale = "en-US"): string {
  // Only format for US locale
  if (!locale.startsWith("en-US") && locale !== "en") {
    return value;
  }

  // Extract digits only
  const digits = value.replace(/\D/g, "");

  // Limit to 10 digits (US phone)
  const limited = digits.slice(0, 10);

  // Progressive formatting based on digit count
  if (limited.length === 0) return "";
  if (limited.length <= 3) return `(${limited}`;
  if (limited.length <= 6)
    return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
  return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
}
