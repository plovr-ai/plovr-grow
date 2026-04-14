"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Container } from "@/components/website/ui/Container";
import { Logo } from "@/components/website/ui/Logo";
import { Icon } from "@/components/website/ui/Icon";
import { siteConfig, type NavLink } from "@/config/site";

function isActive(pathname: string, href: string): boolean {
  const normalized = pathname.replace(/\/$/, "") || "/";
  if (href === "/") return normalized === "/";
  const normalizedHref = href.replace(/\/$/, "");
  return normalized === normalizedHref || normalized.startsWith(normalizedHref + "/");
}

function ChevronDown({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`size-3 ${className}`}
      viewBox="0 0 12 7.4"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M1.41 0L6 4.58 10.59 0 12 1.41l-6 6-6-6L1.41 0z" />
    </svg>
  );
}

function DesktopNavItem({ link, pathname }: { link: NavLink; pathname: string }) {
  const active = isActive(pathname, link.href);
  const baseClass = `text-sm font-medium tracking-tight transition-colors ${
    active
      ? "font-semibold text-ws-text-amber"
      : "text-ws-text-body hover:text-ws-text-heading"
  }`;

  if (!link.children?.length) {
    return (
      <Link href={link.href} className={baseClass}>
        {link.label}
      </Link>
    );
  }

  return (
    <div className="group relative">
      <Link
        href={link.href}
        className={`inline-flex items-center gap-1 ${baseClass}`}
      >
        {link.label}
        <ChevronDown className="transition-transform group-hover:rotate-180" />
      </Link>

      {/* Dropdown */}
      <div className="invisible absolute left-1/2 top-full z-50 w-48 -translate-x-1/2 pt-2 opacity-0 transition-all group-hover:visible group-hover:opacity-100">
        <div className="rounded-xl border border-ws-border bg-white py-2 shadow-lg">
          {link.children.map((child) => (
            <Link
              key={child.label}
              href={child.href}
              className={`block px-4 py-2 text-sm transition-colors ${
                isActive(pathname, child.href)
                  ? "font-semibold text-ws-text-amber"
                  : "text-ws-text-body hover:bg-gray-50 hover:text-ws-text-heading"
              }`}
            >
              {child.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function MobileNavItem({
  link,
  pathname,
  onNavigate,
}: {
  link: NavLink;
  pathname: string;
  onNavigate: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const active = isActive(pathname, link.href);

  if (!link.children?.length) {
    return (
      <Link
        href={link.href}
        aria-current={active ? "page" : undefined}
        className={`block rounded-md px-3 py-3 text-base font-medium ${
          active
            ? "bg-ws-primary-50 text-ws-primary-700"
            : "text-ws-text-body hover:bg-gray-50"
        }`}
        onClick={onNavigate}
      >
        {link.label}
      </Link>
    );
  }

  return (
    <div>
      <button
        type="button"
        className={`flex w-full items-center justify-between rounded-md px-3 py-3 text-base font-medium ${
          active
            ? "bg-ws-primary-50 text-ws-primary-700"
            : "text-ws-text-body hover:bg-gray-50"
        }`}
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        {link.label}
        <ChevronDown
          className={`transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      {expanded && (
        <div className="ml-4 flex flex-col gap-1 py-1">
          {link.children.map((child) => (
            <Link
              key={child.label}
              href={child.href}
              className={`block rounded-md px-3 py-2 text-sm ${
                isActive(pathname, child.href)
                  ? "font-semibold text-ws-text-amber"
                  : "text-ws-text-body hover:bg-gray-50"
              }`}
              onClick={onNavigate}
            >
              {child.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function WebsiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-ws-bg-page">
      <Container>
        <div className="flex h-16 items-center justify-between">
          <Logo />

          {/* Desktop nav */}
          <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
            {siteConfig.nav.map((link) => (
              <DesktopNavItem
                key={link.label}
                link={link}
                pathname={pathname}
              />
            ))}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden items-center gap-4 md:flex">
            <Link
              href={siteConfig.cta.primary.href}
              className="px-6 py-2 bg-primary text-primary-foreground font-bold text-sm rounded-lg hover:bg-primary/90 transition-colors"
            >
              {siteConfig.cta.primary.label}
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-ws-text md:hidden"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <Icon name={mobileOpen ? "close" : "menu"} className="h-6 w-6" />
          </button>
        </div>
      </Container>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-ws-border bg-white md:hidden">
          <Container>
            <nav className="flex flex-col gap-2 py-4" aria-label="Mobile">
              {siteConfig.nav.map((link) => (
                <MobileNavItem
                  key={link.label}
                  link={link}
                  pathname={pathname}
                  onNavigate={() => setMobileOpen(false)}
                />
              ))}
              <div className="mt-2 flex flex-col gap-2 border-t border-ws-border pt-4">
                <Link
                  href={siteConfig.cta.primary.href}
                  className="rounded-lg bg-primary px-4 py-3 text-center font-bold text-primary-foreground hover:bg-primary/90"
                  onClick={() => setMobileOpen(false)}
                >
                  {siteConfig.cta.primary.label}
                </Link>
              </div>
            </nav>
          </Container>
        </div>
      )}
    </header>
  );
}
