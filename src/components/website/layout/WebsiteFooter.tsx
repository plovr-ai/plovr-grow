import Link from "next/link";
import { Container } from "@/components/website/ui/Container";
import { siteConfig } from "@/config/site";

export function WebsiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative bg-ws-bg-card pt-px">
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none border-t border-[rgba(212,197,171,0.15)]"
      />
      <Container>
        <div className="flex flex-col items-center justify-between gap-4 px-0 py-12 md:flex-row">
          <div className="flex flex-col items-center gap-1 md:flex-row md:gap-2">
            <span className="text-lg font-bold tracking-tight text-ws-text-heading">
              {siteConfig.name}
            </span>
            <span className="text-sm text-ws-text-body">
              &copy; {year} {siteConfig.name}. All rights reserved.
            </span>
          </div>

          <nav className="flex items-center gap-8">
            {siteConfig.footer.legal.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-ws-text-body transition-colors hover:text-ws-text-heading"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </Container>
    </footer>
  );
}
