import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

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
 */
export function generateOrderNumber(sequence: number): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const seqStr = sequence.toString().padStart(4, "0");
  return `${dateStr}-${seqStr}`;
}
