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
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-ws-border">
      <Container>
        <div className="flex h-16 items-center justify-between">
          <Logo />

          {/* Desktop nav */}
          <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
            {siteConfig.nav.map((link) => {
              if (link.children && link.children.length > 0) {
                return (
                  <div key={link.label} className="relative group">
                    <Link
                      href={link.href}
                      className={`text-sm transition-colors ${
                        isActive(pathname, link.href)
                          ? "font-semibold text-ws-text"
                          : "text-ws-text-muted hover:text-ws-text"
                      }`}
                    >
                      {link.label}
                    </Link>
                    <div className="absolute left-0 top-full mt-2 w-56 bg-white border border-ws-border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                      <div className="py-2">
                        {link.children.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              }
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  className={`text-sm transition-colors ${
                    isActive(pathname, link.href)
                      ? "font-semibold text-ws-text"
                      : "text-ws-text-muted hover:text-ws-text"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden items-center gap-4 md:flex">
            <Link
              href={siteConfig.cta.primary.href}
              className="px-6 py-2 bg-ws-primary-400 text-ws-primary-700 font-bold text-sm rounded-lg hover:bg-ws-primary-500 transition-colors"
            >
              Get Started
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
                  <div key={link.label}>
                    <Link
                      href={link.href}
                      aria-current={active ? "page" : undefined}
                      className={`block rounded-md px-3 py-3 text-base font-medium ${
                        active
                          ? "bg-ws-primary-50 text-ws-primary-700"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                      onClick={() => setMobileOpen(false)}
                    >
                      {link.label}
                    </Link>
                    {link.children && link.children.length > 0 && (
                      <div className="pl-6 flex flex-col gap-1">
                        {link.children.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            className="rounded-md px-3 py-2 text-sm text-ws-text-muted hover:bg-gray-50"
                            onClick={() => setMobileOpen(false)}
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="mt-2 flex flex-col gap-2 border-t border-ws-border pt-4">
                <Link
                  href={siteConfig.cta.primary.href}
                  className="rounded-lg bg-ws-primary-400 px-4 py-3 text-center font-bold text-ws-primary-700 hover:bg-ws-primary-500"
                  onClick={() => setMobileOpen(false)}
                >
                  Get Started
                </Link>
              </div>
            </nav>
          </Container>
        </div>
      )}
    </header>
  );
}
