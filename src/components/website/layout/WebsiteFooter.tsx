import Link from "next/link";
import { Container } from "@/components/website/ui/Container";
import { siteConfig, type NavLink } from "@/config/site";

function FooterLink({ link }: { link: NavLink }) {
  if (link.external) {
    return (
      <li>
        <a
          href={link.href}
          className="hover:text-white transition-colors"
          rel="noopener noreferrer"
          target="_blank"
        >
          {link.label}
        </a>
      </li>
    );
  }
  return (
    <li>
      <Link href={link.href} className="hover:text-white transition-colors">
        {link.label}
      </Link>
    </li>
  );
}

export function WebsiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-ws-dark text-white px-0 py-12">
      <Container>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div>
            <h3 className="text-lg font-bold">{siteConfig.name}</h3>
            <p className="mt-4 text-sm text-ws-text-subtle">
              AI-powered voice agents for modern restaurants.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-semibold mb-4">Product</h4>
            <ul className="space-y-2 text-sm text-ws-text-subtle">
              {siteConfig.footer.product.map((link) => (
                <FooterLink key={link.href} link={link} />
              ))}
              <li>
                <Link href="/#voice-agent" className="hover:text-white transition-colors">
                  Voice Agent
                </Link>
              </li>
              <li>
                <Link href="/#manager" className="hover:text-white transition-colors">
                  Manager Agent
                </Link>
              </li>
              <li>
                <Link href="/#autopilot" className="hover:text-white transition-colors">
                  Marketing Suite
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-ws-text-subtle">
              {siteConfig.footer.company.map((link) => (
                <FooterLink key={link.href} link={link} />
              ))}
              <li>
                <Link href="/careers" className="hover:text-white transition-colors">
                  Careers
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-ws-text-subtle">
              {siteConfig.footer.legal.map((link) => (
                <FooterLink key={link.href} link={link} />
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-ws-dark-muted text-center text-sm text-ws-text-subtle">
          &copy; {year} {siteConfig.name}. All rights reserved.
        </div>
      </Container>
    </footer>
  );
}
