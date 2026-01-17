"use client";

import { useState } from "react";
import Link from "next/link";
import type { NavigationLink } from "@/types/website";

interface NavigationProps {
  logo: string;
  restaurantName: string;
  /** @deprecated Use companySlug instead */
  tenantSlug?: string;
  /** Company slug for brand-level pages */
  companySlug?: string;
  /** Custom menu link (for single vs multi-store logic) */
  menuLink?: string;
}

export function Navigation({
  logo,
  restaurantName,
  tenantSlug,
  companySlug,
  menuLink,
}: NavigationProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Support both old (tenantSlug) and new (companySlug) props
  const slug = companySlug ?? tenantSlug ?? "";
  const orderLink = menuLink ?? `/r/${slug}/menu`;
  const locationsLink = companySlug ? `/${companySlug}/locations` : `/r/${slug}/locations`;
  const homeLink = companySlug ? `/${companySlug}` : `/r/${slug}`;

  const navLinks: NavigationLink[] = [
    { label: "Menu", href: orderLink },
    { label: "Locations", href: locationsLink },
    { label: "Our Story", href: "#story" },
    { label: "Contact", href: "#location" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link href={homeLink} className="flex items-center gap-3">
            <img
              src={logo}
              alt={restaurantName}
              className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover"
            />
            <span className="font-bold text-lg md:text-xl text-gray-900 hidden sm:block">
              {restaurantName}
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-3">
            <button className="hidden md:block text-gray-600 hover:text-gray-900 font-medium transition-colors">
              Sign In
            </button>
            <Link
              href={orderLink}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 md:px-6 md:py-2.5 rounded-full font-semibold text-sm md:text-base transition-colors"
            >
              Order Online
            </Link>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 text-gray-600 hover:text-gray-900"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 py-4">
            <div className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-gray-600 hover:text-gray-900 font-medium px-2 py-2"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <button className="text-gray-600 hover:text-gray-900 font-medium px-2 py-2 text-left">
                Sign In
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
