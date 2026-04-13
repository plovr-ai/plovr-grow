"use client";

import Image from "next/image";
import Link from "next/link";
import { useFormatPhone } from "@/hooks";
import { useMerchantConfig } from "@/contexts/MerchantContext";
import type { MerchantInfo, SocialLink } from "@/types/website";

interface FooterProps {
  merchant: MerchantInfo;
  /** @deprecated Use companySlug instead */
  tenantSlug?: string;
  /** Company slug for brand-level pages */
  companySlug?: string;
  /** Custom menu link (for single vs multi-store logic) */
  menuLink?: string;
}

function SocialIcon({ platform }: { platform: SocialLink["platform"] }) {
  switch (platform) {
    case "facebook":
      return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      );
    case "instagram":
      return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
        </svg>
      );
    case "twitter":
      return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case "yelp":
      return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20.16 12.594l-4.995 1.433c-.96.276-1.47-.8-.82-1.544l2.88-3.3c.43-.495.15-1.24-.52-1.34l-4.33-.65c-.67-.1-1.14-.72-.95-1.37l1.62-5.33c.19-.62-.35-1.21-.96-1.04L7.3 1.114c-.61.17-.76.95-.26 1.38l3.33 2.86c.5.43.25 1.24-.42 1.38l-5.26 1.08c-.67.14-.92.97-.43 1.45l3.95 3.9c.5.49.18 1.32-.54 1.42l-5.72.77c-.72.1-1 1.03-.45 1.55l4.26 4.05c.54.51.2 1.42-.58 1.52l-6.16.8c-.78.1-1.07 1.12-.45 1.6l5.05 3.95c.62.48 1.52-.02 1.52-.84V17.67c0-.78.74-1.37 1.5-1.2l5.93 1.35c.76.17 1.38-.63 1.03-1.33l-2.82-5.62c-.35-.7.23-1.5 1-1.37l6.06 1c.77.13 1.3-.76.87-1.45l-3.43-5.55c-.43-.7.12-1.6.93-1.5l6.43.8c.8.1 1.28-.87.75-1.5z" />
        </svg>
      );
    case "google":
      return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
        </svg>
      );
  }
}

/**
 * Get the first day of week for a locale (0 = Sunday, 1 = Monday, etc.)
 * Most locales start with Monday, US/Canada/Japan start with Sunday
 */
function getFirstDayOfWeek(locale: string): number {
  // Locales that start week on Sunday
  const sundayFirstLocales = ["en-US", "en-CA", "ja-JP", "ko-KR", "zh-TW"];
  return sundayFirstLocales.some((l) => locale.startsWith(l.split("-")[0]) && locale.includes(l.split("-")[1]))
    ? 0
    : 1;
}

/**
 * Format business hours with locale-aware day names and sorting
 */
function formatBusinessHours(
  hours: MerchantInfo["businessHours"],
  locale: string
): { day: string; time: string }[] {
  // Day keys in ISO order (Monday = 1, Sunday = 7)
  const dayKeys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

  // Get localized day names using Intl API
  const formatter = new Intl.DateTimeFormat(locale, { weekday: "long" });
  // Create a date for each day of week (2024-01-01 is Monday)
  const dayNames: Record<string, string> = {};
  dayKeys.forEach((key, index) => {
    const date = new Date(2024, 0, 1 + index); // Jan 1, 2024 is Monday
    dayNames[key] = formatter.format(date);
  });

  // Determine sort order based on locale's first day of week
  const firstDay = getFirstDayOfWeek(locale);
  const sortedKeys = firstDay === 0
    ? ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] // Sunday first
    : ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]; // Monday first

  return sortedKeys
    .filter((key) => hours[key]) // Only include days that exist in hours
    .map((key) => ({
      day: dayNames[key] || key,
      time: hours[key].closed ? "Closed" : `${hours[key].open} - ${hours[key].close}`,
    }));
}

export function Footer({
  merchant,
  tenantSlug,
  companySlug,
  menuLink,
}: FooterProps) {
  const formatPhone = useFormatPhone();
  const { locale } = useMerchantConfig();
  // Support both old (tenantSlug) and new (companySlug) props
  const slug = companySlug ?? tenantSlug ?? "";
  const orderLink = menuLink ?? `/r/${slug}/menu`;
  // Locations is always a brand-level page
  const locationsLink = `/${slug}/locations`;

  // Check if contact info is available (single-merchant companies)
  const hasContactInfo = Boolean(merchant.phone || merchant.email || merchant.address);
  const hasBusinessHours = Object.keys(merchant.businessHours).length > 0;

  const fullAddress = `${merchant.address}, ${merchant.city}, ${merchant.state} ${merchant.zipCode}`;
  const businessHours = formatBusinessHours(merchant.businessHours, locale);

  return (
    <footer id="location" className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              {merchant.logo ? (
                <Image
                  src={merchant.logo}
                  alt={merchant.name}
                  width={48}
                  height={48}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <span className="flex w-12 h-12 items-center justify-center rounded-full bg-white/20 font-bold text-xl">
                  {merchant.name.charAt(0)}
                </span>
              )}
              <span className="font-bold text-xl">{merchant.name}</span>
            </div>
            <p className="text-gray-400 mb-6">{merchant.tagline}</p>

            {/* Social Links */}
            <div className="flex gap-4">
              {merchant.socialLinks.map((link) => (
                <a
                  key={link.platform}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors"
                  aria-label={link.platform}
                >
                  <SocialIcon platform={link.platform} />
                </a>
              ))}
            </div>
          </div>

          {/* Contact - only show for single-merchant companies */}
          {hasContactInfo && (
            <div>
              <h3 className="font-semibold text-lg mb-4">Contact</h3>
              <div className="space-y-3 text-gray-400">
                {merchant.phone && (
                  <a href={`tel:${merchant.phone}`} className="flex items-center gap-3 hover:text-white transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    {formatPhone(merchant.phone)}
                  </a>
                )}
                {merchant.email && (
                  <a href={`mailto:${merchant.email}`} className="flex items-center gap-3 hover:text-white transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {merchant.email}
                  </a>
                )}
                {merchant.address && (
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {fullAddress}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Hours - only show for single-merchant companies */}
          {hasBusinessHours && (
            <div>
              <h3 className="font-semibold text-lg mb-4">Hours</h3>
              <div className="space-y-2 text-sm">
                {businessHours.map(({ day, time }) => (
                  <div key={day} className="flex justify-between text-gray-400">
                    <span>{day}</span>
                    <span>{time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold text-lg mb-4">Quick Links</h3>
            <div className="space-y-3">
              <Link
                href={orderLink}
                className="block text-gray-400 hover:text-white transition-colors"
              >
                Order Online
              </Link>
              <Link
                href={locationsLink}
                className="block text-gray-400 hover:text-white transition-colors"
              >
                View All Locations
              </Link>
            </div>
            <Link
              href={orderLink}
              className="inline-block mt-4 bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-foreground px-6 py-3 rounded-full font-semibold transition-colors"
            >
              Order Now
            </Link>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-500 text-sm">
          <p>&copy; {new Date().getFullYear()} {merchant.name}. All rights reserved.</p>
          <p className="mt-2">
            Powered by <span className="text-gray-400">Plovr</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
