"use client";

import { Suspense, use, useState, type ReactNode } from "react";
import Link from "next/link";
import type { NavigationLink } from "@/types/website";
import { useLoyalty, type LoyaltyMember } from "@/contexts";
import { SignInModal } from "./SignInModal";
import { UserDropdown } from "./UserDropdown";

interface NavigationProps {
  logo: string;
  restaurantName: string;
  /** @deprecated Use companySlug instead */
  tenantSlug?: string;
  /** Company slug for brand-level pages */
  companySlug?: string;
  /** Custom menu link (for single vs multi-store logic) */
  menuLink?: string;
  /** Custom catering link (for single vs multi-store logic) */
  cateringLink?: string;
  /**
   * Promise resolving to whether loyalty is enabled for this company.
   * Read inside <Suspense> so the nav shell streams first and the
   * loyalty-gated UI (Sign In button, user dropdown, mobile auth block,
   * SignInModal) fills in once the promise resolves. Pages should NOT
   * await this promise — pass it directly so SSR can stream.
   */
  isLoyaltyEnabledPromise?: Promise<boolean>;
}

/**
 * Renders children only when loyalty is enabled for the current company.
 * Reads the flag via React `use()`, so the surrounding <Suspense> boundary
 * holds until the promise resolves and then streams in the slot content.
 */
function LoyaltyEnabledGate({
  promise,
  children,
}: {
  promise: Promise<boolean>;
  children: ReactNode;
}) {
  const isLoyaltyEnabled = use(promise);
  return isLoyaltyEnabled ? <>{children}</> : null;
}

export function Navigation({
  logo,
  restaurantName,
  tenantSlug,
  companySlug,
  menuLink,
  cateringLink,
  isLoyaltyEnabledPromise,
}: NavigationProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const { member, isLoading, logout } = useLoyalty();

  // Support both old (tenantSlug) and new (companySlug) props
  const slug = companySlug ?? tenantSlug ?? "";
  const orderLink = menuLink ?? `/r/${slug}/menu`;
  const cateringHref = cateringLink ?? `/${slug}/locations`;
  // Locations and home are always brand-level pages
  const locationsLink = `/${slug}/locations`;
  const homeLink = `/${slug}`;

  const giftcardLink = `/${slug}/giftcard`;

  const navLinks: NavigationLink[] = [
    { label: "Menu", href: orderLink },
    { label: "Catering", href: cateringHref },
    { label: "Gift Cards", href: giftcardLink },
    { label: "Locations", href: locationsLink },
    { label: "Our Story", href: "#story" },
  ];

  // Render auth section for desktop
  const desktopAuth = renderDesktopAuth({
    isLoading,
    member,
    showUserDropdown,
    setShowUserDropdown,
    onSignInClick: () => setShowSignInModal(true),
    onLogout: logout,
  });

  // Render auth section for mobile
  const mobileAuth = renderMobileAuth({
    isLoading,
    member,
    onSignInClick: () => {
      setShowSignInModal(true);
      setIsMobileMenuOpen(false);
    },
    onLogout: () => {
      logout();
      setIsMobileMenuOpen(false);
    },
  });

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Logo */}
            <Link href={homeLink} className="flex items-center gap-3">
              {logo ? (
                <img
                  src={logo}
                  alt={restaurantName}
                  width={48}
                  height={48}
                  loading="eager"
                  className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover"
                />
              ) : (
                <span className="flex w-10 h-10 md:w-12 md:h-12 items-center justify-center rounded-full bg-theme-primary text-theme-primary-foreground font-bold text-lg">
                  {restaurantName.charAt(0)}
                </span>
              )}
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
              {isLoyaltyEnabledPromise && (
                <Suspense fallback={null}>
                  <LoyaltyEnabledGate promise={isLoyaltyEnabledPromise}>
                    {desktopAuth}
                  </LoyaltyEnabledGate>
                </Suspense>
              )}
              <Link
                href={orderLink}
                className="bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-foreground px-4 py-2 md:px-6 md:py-2.5 rounded-full font-semibold text-sm md:text-base transition-colors"
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
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
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
                {isLoyaltyEnabledPromise && (
                  <Suspense fallback={null}>
                    <LoyaltyEnabledGate promise={isLoyaltyEnabledPromise}>
                      {mobileAuth}
                    </LoyaltyEnabledGate>
                  </Suspense>
                )}
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Sign In Modal — only mounted once loyalty flag resolves as enabled */}
      {isLoyaltyEnabledPromise && (
        <Suspense fallback={null}>
          <LoyaltyEnabledGate promise={isLoyaltyEnabledPromise}>
            <SignInModal
              isOpen={showSignInModal}
              onClose={() => setShowSignInModal(false)}
            />
          </LoyaltyEnabledGate>
        </Suspense>
      )}
    </>
  );
}

function renderDesktopAuth({
  isLoading,
  member,
  showUserDropdown,
  setShowUserDropdown,
  onSignInClick,
  onLogout,
}: {
  isLoading: boolean;
  member: LoyaltyMember | null;
  showUserDropdown: boolean;
  setShowUserDropdown: (v: boolean) => void;
  onSignInClick: () => void;
  onLogout: () => void;
}) {
  if (isLoading) {
    return (
      <div className="hidden md:block w-20 h-8 bg-gray-100 rounded animate-pulse" />
    );
  }

  if (member) {
    const displayName = member.firstName || "Member";
    return (
      <div className="hidden md:block relative">
        <button
          onClick={() => setShowUserDropdown(!showUserDropdown)}
          className="flex items-center gap-1 text-gray-600 hover:text-gray-900 font-medium transition-colors"
        >
          <span>Hi, {displayName}</span>
          <svg
            className={`w-4 h-4 transition-transform ${showUserDropdown ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
        {showUserDropdown && (
          <UserDropdown
            member={member}
            onLogout={onLogout}
            onClose={() => setShowUserDropdown(false)}
          />
        )}
      </div>
    );
  }

  return (
    <button
      onClick={onSignInClick}
      className="hidden md:block text-gray-600 hover:text-gray-900 font-medium transition-colors"
    >
      Sign In
    </button>
  );
}

function renderMobileAuth({
  isLoading,
  member,
  onSignInClick,
  onLogout,
}: {
  isLoading: boolean;
  member: LoyaltyMember | null;
  onSignInClick: () => void;
  onLogout: () => void;
}) {
  if (isLoading) {
    return <div className="w-32 h-8 bg-gray-100 rounded animate-pulse mx-2" />;
  }

  if (member) {
    const displayName = member.firstName || "Member";
    return (
      <div className="border-t border-gray-100 mt-2 pt-4">
        <div className="px-2 py-2">
          <div className="text-gray-900 font-medium">Hi, {displayName}</div>
          <div className="flex items-center gap-1 mt-1">
            <svg
              className="w-4 h-4 text-theme-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
              />
            </svg>
            <span className="text-sm font-semibold text-theme-primary">
              {member.points} pts
            </span>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full text-left text-gray-600 hover:text-gray-900 font-medium px-2 py-2"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={onSignInClick}
      className="text-gray-600 hover:text-gray-900 font-medium px-2 py-2 text-left"
    >
      Sign In
    </button>
  );
}
