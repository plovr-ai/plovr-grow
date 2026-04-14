export interface NavDropdownItem {
  label: string;
  href: string;
}

export interface NavLink {
  label: string;
  href: string;
  external?: boolean;
  children?: NavDropdownItem[];
}

export interface CTA {
  label: string;
  href: string;
  external?: boolean;
}

interface SocialLink {
  platform: string;
  url: string;
  label: string;
}

interface SiteConfig {
  name: string;
  tagline: string;
  description: string;
  url: string;
  ogImage: string;
  locale: string;
  nav: NavLink[];
  footer: {
    product?: NavLink[];
    company?: NavLink[];
    resources?: NavLink[];
    legal: NavLink[];
    social: SocialLink[];
  };
  cta: {
    primary: CTA;
    secondary: CTA;
    login: CTA;
  };
}

export const siteConfig: SiteConfig = {
  name: "Localgrow",
  tagline: "Your Agentic Restaurant Partner",
  description:
    "Localgrow is an AI voice agent that turns missed calls into booked orders for restaurants and hospitality businesses.",
  url: "https://www.localgrow.ai",
  ogImage: "/og.svg",
  locale: "en-US",
  nav: [
    {
      label: "Product",
      href: "/",
      children: [
        { label: "Voice Agent", href: "/#voice-agent" },
        { label: "Grow Agent", href: "/grow-agent" },
      ],
    },
    { label: "Pricing", href: "/pricing" },
    {
      label: "Company",
      href: "/about",
      children: [
        { label: "About Us", href: "/about" },
        { label: "Contact", href: "mailto:hello@localgrow.ai" },
      ],
    },
    {
      label: "Resources",
      href: "/blog",
      children: [
        { label: "Blog", href: "/blog" },
      ],
    },
  ],
  footer: {
    legal: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Cookie Policy", href: "/cookies" },
    ],
    social: [
      {
        platform: "instagram",
        url: "https://www.instagram.com/localgrowai1/",
        label: "Follow us on Instagram",
      },
      {
        platform: "linkedin",
        url: "https://www.linkedin.com/company/localgrowai/",
        label: "Follow us on LinkedIn",
      },
    ],
  },
  cta: {
    primary: { label: "Get a Free Demo", href: "/dashboard/login" },
    secondary: { label: "Request Demo", href: "/dashboard/login" },
    login: { label: "Login", href: "/dashboard/login" },
  },
};
