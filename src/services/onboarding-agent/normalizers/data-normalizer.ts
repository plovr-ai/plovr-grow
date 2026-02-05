/**
 * Data Normalizer
 *
 * Normalizes and validates extracted data before merging.
 */

import type {
  ExtractedRestaurantInfo,
  ExtractedMenuCategory,
  ExtractedMenuItem,
} from "../onboarding-agent.types";

/**
 * Normalize restaurant info
 */
export function normalizeRestaurantInfo(
  info: ExtractedRestaurantInfo
): ExtractedRestaurantInfo {
  return {
    ...info,
    name: info.name?.trim(),
    description: info.description?.trim(),
    tagline: info.tagline?.trim(),
    address: info.address?.trim(),
    city: info.city?.trim(),
    state: normalizeState(info.state),
    zipCode: normalizeZipCode(info.zipCode),
    phone: normalizePhone(info.phone),
    email: normalizeEmail(info.email),
    logoUrl: normalizeUrl(info.logoUrl),
    heroImageUrl: normalizeUrl(info.heroImageUrl),
    businessHours: info.businessHours,
    socialLinks: info.socialLinks?.map((link) => ({
      ...link,
      url: normalizeUrl(link.url) ?? link.url,
    })),
  };
}

/**
 * Normalize menu categories
 */
export function normalizeMenuCategories(
  categories: ExtractedMenuCategory[]
): ExtractedMenuCategory[] {
  return categories
    .filter((cat) => cat.name && cat.items.length > 0)
    .map((category) => ({
      ...category,
      name: category.name.trim(),
      description: category.description?.trim(),
      imageUrl: normalizeUrl(category.imageUrl),
      items: normalizeMenuItems(category.items),
    }));
}

/**
 * Normalize menu items
 */
export function normalizeMenuItems(
  items: ExtractedMenuItem[]
): ExtractedMenuItem[] {
  return items
    .filter((item) => item.name && item.price >= 0)
    .map((item) => ({
      ...item,
      name: item.name.trim(),
      description: item.description?.trim(),
      price: normalizePrice(item.price),
      imageUrl: normalizeUrl(item.imageUrl),
      tags: item.tags?.map((t) => t.toLowerCase().trim()),
      modifiers: item.modifiers?.map((mod) => ({
        ...mod,
        name: mod.name.trim(),
        options: mod.options.map((opt) => ({
          name: opt.name.trim(),
          price: normalizePrice(opt.price),
        })),
      })),
    }));
}

/**
 * Normalize state to 2-letter abbreviation
 */
function normalizeState(state: string | undefined): string | undefined {
  if (!state) return undefined;

  const trimmed = state.trim().toUpperCase();

  // Already 2 letters
  if (/^[A-Z]{2}$/.test(trimmed)) {
    return trimmed;
  }

  // Full state name mapping
  const stateMap: Record<string, string> = {
    ALABAMA: "AL",
    ALASKA: "AK",
    ARIZONA: "AZ",
    ARKANSAS: "AR",
    CALIFORNIA: "CA",
    COLORADO: "CO",
    CONNECTICUT: "CT",
    DELAWARE: "DE",
    FLORIDA: "FL",
    GEORGIA: "GA",
    HAWAII: "HI",
    IDAHO: "ID",
    ILLINOIS: "IL",
    INDIANA: "IN",
    IOWA: "IA",
    KANSAS: "KS",
    KENTUCKY: "KY",
    LOUISIANA: "LA",
    MAINE: "ME",
    MARYLAND: "MD",
    MASSACHUSETTS: "MA",
    MICHIGAN: "MI",
    MINNESOTA: "MN",
    MISSISSIPPI: "MS",
    MISSOURI: "MO",
    MONTANA: "MT",
    NEBRASKA: "NE",
    NEVADA: "NV",
    "NEW HAMPSHIRE": "NH",
    "NEW JERSEY": "NJ",
    "NEW MEXICO": "NM",
    "NEW YORK": "NY",
    "NORTH CAROLINA": "NC",
    "NORTH DAKOTA": "ND",
    OHIO: "OH",
    OKLAHOMA: "OK",
    OREGON: "OR",
    PENNSYLVANIA: "PA",
    "RHODE ISLAND": "RI",
    "SOUTH CAROLINA": "SC",
    "SOUTH DAKOTA": "SD",
    TENNESSEE: "TN",
    TEXAS: "TX",
    UTAH: "UT",
    VERMONT: "VT",
    VIRGINIA: "VA",
    WASHINGTON: "WA",
    "WEST VIRGINIA": "WV",
    WISCONSIN: "WI",
    WYOMING: "WY",
  };

  return stateMap[trimmed] || trimmed;
}

/**
 * Normalize ZIP code to 5 digits
 */
function normalizeZipCode(zipCode: string | undefined): string | undefined {
  if (!zipCode) return undefined;

  // Extract 5 digits
  const match = zipCode.match(/\d{5}/);
  return match ? match[0] : undefined;
}

/**
 * Normalize phone number
 */
function normalizePhone(phone: string | undefined): string | undefined {
  if (!phone) return undefined;

  // Extract digits
  const digits = phone.replace(/\D/g, "");

  // Format as (XXX) XXX-XXXX
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  // If 11 digits starting with 1, remove the 1
  if (digits.length === 11 && digits.startsWith("1")) {
    const localDigits = digits.slice(1);
    return `(${localDigits.slice(0, 3)}) ${localDigits.slice(3, 6)}-${localDigits.slice(6)}`;
  }

  // Return original if can't normalize
  return phone.trim();
}

/**
 * Normalize email
 */
function normalizeEmail(email: string | undefined): string | undefined {
  if (!email) return undefined;

  const trimmed = email.trim().toLowerCase();

  // Basic email validation
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return trimmed;
  }

  return undefined;
}

/**
 * Normalize URL
 */
function normalizeUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;

  const trimmed = url.trim();

  // Already a valid URL
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  // Protocol-relative URL
  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }

  // Looks like a domain
  if (/^[a-z0-9-]+\.[a-z]{2,}/i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return undefined;
}

/**
 * Normalize price to 2 decimal places
 */
function normalizePrice(price: number): number {
  return Math.round(price * 100) / 100;
}
