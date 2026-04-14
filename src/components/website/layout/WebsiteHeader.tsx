"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Container } from "@/components/website/ui/Container";
import { Logo } from "@/components/website/ui/Logo";
import { Icon } from "@/components/website/ui/Icon";
import { siteConfig } from "@/config/site";

function isActive(pathname: string, href: string): boolean {
  const normalized = pathname.replace(/\/$/, "") || "/";
  if (href === "/") return normalized === "/";
  const normalizedHref = href.replace(/\/$/, "");
  return normalized === normalizedHref || normalized.startsWith(normalizedHref + "/");
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
              <Link
                key={link.label}
                href={link.href}
                className={`text-sm font-medium tracking-tight transition-colors ${
                  isActive(pathname, link.href)
                    ? "font-semibold text-ws-text-amber"
                    : "text-ws-text-body hover:text-ws-text-heading"
                }`}
              >
                {link.label}
              </Link>
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
              {siteConfig.nav.map((link) => {
                const active = isActive(pathname, link.href);
                return (
                  <Link
                    key={link.label}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={`block rounded-md px-3 py-3 text-base font-medium ${
                      active
                        ? "bg-ws-primary-50 text-ws-primary-700"
                        : "text-ws-text-body hover:bg-gray-50"
                    }`}
                    onClick={() => setMobileOpen(false)}
                  >
                    {link.label}
                  </Link>
                );
              })}
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
