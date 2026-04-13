# Website-Ava Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the LocalGrow marketing website from Astro into plovr-grow as Next.js React components under the `(website)` route group.

**Architecture:** Rename `(platform)` to `(website)`, add website-specific layout with Header/Footer, convert all Astro components to React Server Components, add MDX content pipeline for blog/releases, unify theme to amber/yellow, update auth links to internal routes.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, MDX (`@next/mdx`, `gray-matter`), Manrope font via `next/font/google`

**Source project:** `../website-ava` (on `main` branch) — reference only, do not modify.

---

## File Structure

```
src/
├── app/
│   ├── (website)/                    # renamed from (platform)
│   │   ├── layout.tsx                # Website layout with Header + Footer + Manrope font
│   │   ├── page.tsx                  # Home page
│   │   ├── pricing/page.tsx
│   │   ├── about/page.tsx
│   │   ├── blog/page.tsx
│   │   ├── blog/[slug]/page.tsx
│   │   ├── releases/page.tsx
│   │   ├── calculator/              # existing, unchanged
│   │   ├── claim/                   # existing, unchanged
│   │   ├── customer-loss/           # existing, unchanged
│   │   └── generator/               # existing, unchanged
│   ├── globals.css                   # add website theme CSS variables
│   └── layout.tsx                    # add Manrope font variable
├── components/website/
│   ├── layout/
│   │   ├── WebsiteHeader.tsx         # client component (mobile menu toggle)
│   │   └── WebsiteFooter.tsx         # server component
│   ├── sections/
│   │   ├── HomeHero.tsx
│   │   ├── ValueProp.tsx
│   │   ├── VoiceAgent.tsx
│   │   ├── AutoPilot.tsx
│   │   ├── DarkChatSection.tsx
│   │   ├── Testimonials.tsx
│   │   ├── CTACard.tsx
│   │   ├── Hero.tsx
│   │   ├── PricingTable.tsx
│   │   ├── FAQ.tsx                   # client component (details toggle)
│   │   ├── MissionBlock.tsx
│   │   ├── ValuesGrid.tsx
│   │   ├── Timeline.tsx
│   │   ├── ImageBlock.tsx
│   │   ├── BlogGrid.tsx
│   │   ├── ArticleLayout.tsx
│   │   └── ReleaseTimeline.tsx
│   └── ui/
│       ├── Container.tsx
│       ├── Section.tsx
│       ├── Badge.tsx
│       ├── WebsiteButton.tsx
│       ├── Icon.tsx
│       ├── Logo.tsx
│       └── Prose.tsx
├── config/
│   └── site.ts                       # copied & adapted from website-ava
├── content/
│   ├── blog/
│   │   ├── welcome-to-localgrow.mdx
│   │   └── restaurant-ai-call-handling.mdx
│   └── releases/
│       ├── spring-2024.md
│       ├── winter-2024.md
│       └── connectivity-update.md
└── lib/
    └── content.ts                    # MDX/Markdown content utilities
```

---

## Task 1: Foundation — Route Group Rename, Theme CSS, Font, Dependencies

**Files:**
- Rename: `src/app/(platform)/` → `src/app/(website)/`
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`
- Modify: `package.json`
- Create: `src/config/site.ts`

- [ ] **Step 1: Install dependencies**

```bash
npm install @next/mdx @mdx-js/loader @mdx-js/react gray-matter next-mdx-remote
```

- [ ] **Step 2: Rename (platform) to (website)**

```bash
git mv 'src/app/(platform)' 'src/app/(website)'
```

- [ ] **Step 3: Add Manrope font to root layout**

In `src/app/layout.tsx`, add the Manrope import alongside existing fonts:

```typescript
import { Geist, Geist_Mono } from "next/font/google";
import { Manrope } from "next/font/google";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});
```

Add `${manrope.variable}` to the body className:

```tsx
<body className={`${geistSans.variable} ${geistMono.variable} ${manrope.variable} antialiased`}>
```

- [ ] **Step 4: Add website theme CSS variables to globals.css**

Add these CSS variables to the `:root` block in `src/app/globals.css` (after existing theme variables):

```css
/* Website theme — amber/yellow (from website-ava) */
--color-primary-50: #fffaeb;
--color-primary-100: #fef0c7;
--color-primary-200: #fedf89;
--color-primary-300: #fec84b;
--color-primary-400: #fdb022;
--color-primary-500: #f5b800;
--color-primary-600: #dc9b00;
--color-primary-700: #b27900;

--color-bg: #ffffff;
--color-bg-subtle: #fafaf7;
--color-bg-warm: #fff8e9;
--color-surface: #ffffff;
--color-text: #0a0a0a;
--color-text-muted: #6b6b6b;
--color-text-subtle: #9a9a9a;

--color-dark: #0f0f0f;
--color-dark-muted: #1c1c1c;

--font-display: var(--font-manrope);

--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.06);
--shadow-lg: 0 12px 32px rgba(0, 0, 0, 0.08);
--shadow-glow: 0 12px 48px rgba(245, 184, 0, 0.2);
```

Also add these Tailwind v4 `@theme inline` entries for the website-specific tokens:

```css
--color-ws-primary-50: var(--color-primary-50);
--color-ws-primary-100: var(--color-primary-100);
--color-ws-primary-200: var(--color-primary-200);
--color-ws-primary-300: var(--color-primary-300);
--color-ws-primary-400: var(--color-primary-400);
--color-ws-primary-500: var(--color-primary-500);
--color-ws-primary-600: var(--color-primary-600);
--color-ws-primary-700: var(--color-primary-700);
--color-ws-bg: var(--color-bg);
--color-ws-bg-subtle: var(--color-bg-subtle);
--color-ws-bg-warm: var(--color-bg-warm);
--color-ws-surface: var(--color-surface);
--color-ws-text: var(--color-text);
--color-ws-text-muted: var(--color-text-muted);
--color-ws-text-subtle: var(--color-text-subtle);
--color-ws-dark: var(--color-dark);
--color-ws-dark-muted: var(--color-dark-muted);
--color-ws-border: #ececec;
--color-ws-success: #16a34a;
--font-display: var(--font-manrope);
--shadow-elev-sm: var(--shadow-sm);
--shadow-elev-md: var(--shadow-md);
--shadow-elev-lg: var(--shadow-lg);
--shadow-elev-glow: var(--shadow-glow);
```

And add the text-gradient utility:

```css
@layer utilities {
  .text-gradient-hero {
    background: linear-gradient(128.537deg, rgb(25, 28, 29) 0%, rgb(80, 69, 50) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
}
```

- [ ] **Step 5: Create site config**

Create `src/config/site.ts` — adapted from website-ava with internal auth links:

```typescript
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

export interface SiteConfig {
  name: string;
  tagline: string;
  description: string;
  url: string;
  ogImage: string;
  locale: string;
  nav: NavLink[];
  footer: {
    product: NavLink[];
    company: NavLink[];
    resources: NavLink[];
    legal: NavLink[];
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
        { label: "Manager Agent", href: "/#manager" },
        { label: "Marketing Suite", href: "/#autopilot" },
        { label: "Analytics", href: "/#analytics" },
      ],
    },
    { label: "Pricing", href: "/pricing" },
    {
      label: "Company",
      href: "/about",
      children: [
        { label: "About Us", href: "/about" },
        { label: "Blog", href: "/blog" },
        { label: "Careers", href: "/careers" },
        { label: "Contact", href: "mailto:hello@localgrow.ai" },
      ],
    },
    {
      label: "Resources",
      href: "/blog",
      children: [
        { label: "Documentation", href: "/docs" },
        { label: "Case Studies", href: "/case-studies" },
        { label: "Support", href: "/support" },
        { label: "API Reference", href: "/api" },
      ],
    },
  ],

  footer: {
    product: [
      { label: "Pricing", href: "/pricing" },
      { label: "Release Notes", href: "/releases" },
    ],
    company: [
      { label: "About", href: "/about" },
      { label: "Blog", href: "/blog" },
      { label: "Contact", href: "mailto:hello@localgrow.ai", external: true },
    ],
    resources: [
      { label: "Get Started", href: "/dashboard/login" },
      { label: "Request Demo", href: "/dashboard/login" },
      { label: "Login", href: "/dashboard/login" },
    ],
    legal: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },

  cta: {
    primary: { label: "Get Started", href: "/dashboard/login" },
    secondary: { label: "Request Demo", href: "/dashboard/login" },
    login: { label: "Login", href: "/dashboard/login" },
  },
};
```

- [ ] **Step 6: Copy static assets**

```bash
cp ../website-ava/public/logo.svg public/logo.svg
cp ../website-ava/public/og.svg public/og.svg
```

Note: `favicon.svg` — check if plovr-grow already has one. If the brand is LocalGrow, replace it:

```bash
cp ../website-ava/public/favicon.svg public/favicon.svg
```

- [ ] **Step 7: Verify the app still builds**

```bash
npm run build
```

Expected: Build succeeds. Existing routes under `(website)/` (calculator, claim, etc.) still work.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: rename (platform) to (website), add amber theme + Manrope font + site config"
```

---

## Task 2: Website UI Components

**Files:**
- Create: `src/components/website/ui/Container.tsx`
- Create: `src/components/website/ui/Section.tsx`
- Create: `src/components/website/ui/Badge.tsx`
- Create: `src/components/website/ui/WebsiteButton.tsx`
- Create: `src/components/website/ui/Icon.tsx`
- Create: `src/components/website/ui/Logo.tsx`
- Create: `src/components/website/ui/Prose.tsx`

- [ ] **Step 1: Create Container**

`src/components/website/ui/Container.tsx`:

```tsx
interface ContainerProps {
  size?: "default" | "narrow";
  className?: string;
  children: React.ReactNode;
}

export function Container({ size = "default", className = "", children }: ContainerProps) {
  const max = size === "narrow" ? "max-w-6xl" : "max-w-7xl";
  return <div className={`mx-auto w-full px-6 md:px-8 ${max} ${className}`}>{children}</div>;
}
```

- [ ] **Step 2: Create Section**

`src/components/website/ui/Section.tsx`:

```tsx
interface SectionProps {
  variant?: "default" | "subtle" | "warm" | "dark";
  id?: string;
  className?: string;
  children: React.ReactNode;
}

const bgMap = {
  default: "bg-white",
  subtle: "bg-[var(--color-bg-subtle)]",
  warm: "bg-[var(--color-bg-warm)]",
  dark: "bg-[var(--color-dark)] text-white",
};

export function Section({ variant = "default", id, className = "", children }: SectionProps) {
  return (
    <section id={id} className={`${bgMap[variant]} py-16 md:py-24 ${className}`}>
      {children}
    </section>
  );
}
```

- [ ] **Step 3: Create Badge**

`src/components/website/ui/Badge.tsx`:

```tsx
interface BadgeProps {
  variant?: "primary" | "neutral" | "success";
  className?: string;
  children: React.ReactNode;
}

const variants = {
  primary: "bg-[var(--color-primary-100)] text-[var(--color-primary-700)]",
  neutral: "bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]",
  success: "bg-green-100 text-green-600",
};

export function Badge({ variant = "primary", className = "", children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 4: Create WebsiteButton**

`src/components/website/ui/WebsiteButton.tsx`:

```tsx
import Link from "next/link";

interface WebsiteButtonProps {
  href?: string;
  variant?: "primary" | "secondary" | "ghost" | "dark";
  size?: "sm" | "md" | "lg";
  type?: "button" | "submit";
  className?: string;
  external?: boolean;
  children: React.ReactNode;
}

const base =
  "inline-flex items-center justify-center gap-2 font-semibold rounded-full transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)] focus-visible:ring-offset-2";

const variantStyles = {
  primary: "bg-[var(--color-primary-500)] text-[var(--color-dark)] hover:bg-[var(--color-primary-400)] active:bg-[var(--color-primary-600)]",
  secondary: "bg-white text-[var(--color-text)] border border-[var(--color-border)] hover:bg-[var(--color-bg-subtle)]",
  ghost: "bg-transparent text-[var(--color-text)] hover:bg-[var(--color-bg-subtle)]",
  dark: "bg-[var(--color-dark)] text-white hover:bg-[var(--color-dark-muted)]",
};

const sizeStyles = {
  sm: "text-sm px-4 py-2",
  md: "text-base px-6 py-3",
  lg: "text-lg px-8 py-4",
};

export function WebsiteButton({
  href,
  variant = "primary",
  size = "md",
  type = "button",
  className = "",
  external = false,
  children,
}: WebsiteButtonProps) {
  const cls = `${base} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`;

  if (href) {
    if (external) {
      return (
        <a href={href} className={cls} rel="noopener noreferrer" target="_blank">
          {children}
        </a>
      );
    }
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} className={cls}>
      {children}
    </button>
  );
}
```

- [ ] **Step 5: Create Icon**

`src/components/website/ui/Icon.tsx`:

```tsx
interface IconProps {
  name: "check" | "arrow-right" | "phone" | "star" | "close" | "menu" | "plus" | "minus";
  className?: string;
}

const paths: Record<string, string> = {
  check: "M5 13l4 4L19 7",
  "arrow-right": "M5 12h14M13 5l7 7-7 7",
  phone: "M3 5a2 2 0 012-2h2l2 5-2 1a11 11 0 005 5l1-2 5 2v2a2 2 0 01-2 2A16 16 0 013 5z",
  star: "M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z",
  close: "M6 6l12 12M18 6L6 18",
  menu: "M4 6h16M4 12h16M4 18h16",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
};

export function Icon({ name, className = "h-5 w-5" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
```

- [ ] **Step 6: Create Logo**

`src/components/website/ui/Logo.tsx`:

```tsx
import Link from "next/link";
import Image from "next/image";

interface LogoProps {
  className?: string;
  variant?: "dark" | "light";
}

export function Logo({ className = "", variant = "dark" }: LogoProps) {
  const textColor = variant === "light" ? "text-white" : "text-[var(--color-text)]";
  return (
    <Link href="/" className={`inline-flex items-center gap-2 ${className}`} aria-label="Localgrow home">
      <Image src="/logo.svg" alt="" width={28} height={28} aria-hidden="true" />
      <span className={`font-[family-name:var(--font-manrope)] text-base font-extrabold tracking-tight ${textColor}`}>
        LocalGrow.ai
      </span>
    </Link>
  );
}
```

- [ ] **Step 7: Create Prose**

`src/components/website/ui/Prose.tsx`:

```tsx
interface ProseProps {
  className?: string;
  children: React.ReactNode;
}

export function Prose({ className = "", children }: ProseProps) {
  return (
    <div
      className={`prose prose-lg max-w-none
        prose-headings:font-[family-name:var(--font-manrope)] prose-headings:text-[var(--color-text)]
        prose-a:text-[var(--color-primary-600)] prose-a:no-underline hover:prose-a:underline
        prose-strong:text-[var(--color-text)] prose-code:text-[var(--color-primary-700)]
        prose-blockquote:border-l-[var(--color-primary-500)]
        ${className}`}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 8: Verify build**

```bash
npm run build
```

- [ ] **Step 9: Commit**

```bash
git add src/components/website/ui/
git commit -m "feat(website): add UI base components (Container, Section, Badge, Button, Icon, Logo, Prose)"
```

---

## Task 3: Website Layout (Header + Footer)

**Files:**
- Create: `src/components/website/layout/WebsiteHeader.tsx`
- Create: `src/components/website/layout/WebsiteFooter.tsx`
- Modify: `src/app/(website)/layout.tsx`

- [ ] **Step 1: Create WebsiteHeader**

`src/components/website/layout/WebsiteHeader.tsx` — This is a client component due to mobile menu toggle:

```tsx
"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/website/ui/Container";
import { Logo } from "@/components/website/ui/Logo";
import { Icon } from "@/components/website/ui/Icon";
import { siteConfig } from "@/config/site";

export function WebsiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    const normalized = href.replace(/\/$/, "");
    return pathname === normalized || pathname.startsWith(normalized + "/");
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100">
      <Container>
        <div className="flex h-16 items-center justify-between">
          <Logo />

          <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
            {siteConfig.nav.map((link) => {
              if (link.children && link.children.length > 0) {
                return (
                  <div key={link.label} className="relative group">
                    <Link
                      href={link.href}
                      className={`text-sm transition-colors ${
                        isActive(link.href)
                          ? "font-semibold text-gray-900"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      {link.label}
                    </Link>
                    <div className="absolute left-0 top-full mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
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
                    isActive(link.href)
                      ? "font-semibold text-gray-900"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="hidden items-center gap-4 md:flex">
            <Link
              href="/dashboard/login"
              className="px-6 py-2 bg-yellow-400 text-yellow-900 font-bold text-sm rounded-lg hover:bg-yellow-500 transition-colors"
            >
              Get Started
            </Link>
          </div>

          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-gray-900 md:hidden"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <Icon name={mobileOpen ? "close" : "menu"} className="h-6 w-6" />
          </button>
        </div>
      </Container>

      {mobileOpen && (
        <div className="border-t border-gray-100 bg-white md:hidden">
          <Container>
            <nav className="flex flex-col gap-2 py-4" aria-label="Mobile">
              {siteConfig.nav.map((link) => (
                <div key={link.label}>
                  <Link
                    href={link.href}
                    aria-current={isActive(link.href) ? "page" : undefined}
                    className={`rounded-md px-3 py-3 text-base font-medium block ${
                      isActive(link.href)
                        ? "bg-yellow-50 text-yellow-900"
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
                          className="rounded-md px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 block"
                          onClick={() => setMobileOpen(false)}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div className="mt-2 flex flex-col gap-2 border-t border-gray-100 pt-4">
                <Link
                  href="/dashboard/login"
                  className="rounded-lg bg-yellow-400 px-4 py-3 text-center font-bold text-yellow-900 hover:bg-yellow-500"
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
```

- [ ] **Step 2: Create WebsiteFooter**

`src/components/website/layout/WebsiteFooter.tsx`:

```tsx
import Link from "next/link";
import { Container } from "@/components/website/ui/Container";
import { siteConfig } from "@/config/site";

function FooterLinkList({ title, links }: { title: string; links: typeof siteConfig.footer.product }) {
  return (
    <div>
      <h4 className="font-semibold mb-4">{title}</h4>
      <ul className="space-y-2 text-sm text-gray-400">
        {links.map((link) => (
          <li key={link.label}>
            {link.external ? (
              <a href={link.href} className="hover:text-white transition-colors" rel="noopener noreferrer" target="_blank">
                {link.label}
              </a>
            ) : (
              <Link href={link.href} className="hover:text-white transition-colors">
                {link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function WebsiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-white px-0 py-12">
      <Container>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div>
            <h3 className="text-lg font-bold">{siteConfig.name}</h3>
            <p className="mt-4 text-sm text-gray-400">
              AI-powered voice agents for modern restaurants.
            </p>
          </div>

          <FooterLinkList
            title="Product"
            links={[
              ...siteConfig.footer.product,
              { label: "Voice Agent", href: "/#voice-agent" },
              { label: "Manager Agent", href: "/#manager" },
              { label: "Marketing Suite", href: "/#autopilot" },
            ]}
          />

          <FooterLinkList
            title="Company"
            links={[
              ...siteConfig.footer.company,
              { label: "Careers", href: "/careers" },
            ]}
          />

          <FooterLinkList title="Legal" links={siteConfig.footer.legal} />
        </div>

        <div className="mt-12 pt-8 border-t border-gray-800 text-center text-sm text-gray-400">
          &copy; {year} {siteConfig.name}. All rights reserved.
        </div>
      </Container>
    </footer>
  );
}
```

- [ ] **Step 3: Update website layout**

Replace `src/app/(website)/layout.tsx`:

```tsx
import { WebsiteHeader } from "@/components/website/layout/WebsiteHeader";
import { WebsiteFooter } from "@/components/website/layout/WebsiteFooter";

export default function WebsiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <WebsiteHeader />
      <main className="pt-16 font-[family-name:var(--font-manrope)]">{children}</main>
      <WebsiteFooter />
    </>
  );
}
```

- [ ] **Step 4: Verify build + run dev server**

```bash
npm run build
npm run dev
```

Visit `http://localhost:3000/calculator` — should now have website header/footer wrapping the calculator page.

- [ ] **Step 5: Commit**

```bash
git add src/components/website/layout/ src/app/\(website\)/layout.tsx
git commit -m "feat(website): add WebsiteHeader + WebsiteFooter + layout"
```

---

## Task 4: Home Page Sections (Part 1 — HomeHero, ValueProp, VoiceAgent)

**Files:**
- Create: `src/components/website/sections/HomeHero.tsx`
- Create: `src/components/website/sections/ValueProp.tsx`
- Create: `src/components/website/sections/VoiceAgent.tsx`
- Create: `src/app/(website)/page.tsx` (partial — will complete in Task 5)

- [ ] **Step 1: Create HomeHero**

`src/components/website/sections/HomeHero.tsx`:

```tsx
import { Container } from "@/components/website/ui/Container";

interface HeroFeature {
  icon: string;
  label: string;
  caption: string;
}

interface HomeHeroProps {
  eyebrow?: string;
  title: string;
  titleAccent?: string;
  description: string;
  pricingLabel?: string;
  pricingValue?: string;
  pricingOriginal?: string;
  pricingBadge?: string;
  features?: HeroFeature[];
  inputPlaceholder?: string;
  primaryCta: { label: string; href: string; external?: boolean };
}

const featureIcons: Record<string, string[]> = {
  mic: [
    "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z",
    "M19 10v2a7 7 0 0 1-14 0v-2",
    "M12 19v3",
  ],
  clock: [
    "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z",
    "M12 6v6l4 2",
  ],
  "phone-forwarded": [
    "M22 8V2l-6 6",
    "M16 2h6",
    "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z",
  ],
  zap: ["M13 2 3 14h9l-1 8 10-12h-9l1-8z"],
};

function FeatureIcon({ icon }: { icon: string }) {
  const paths = featureIcons[icon] || featureIcons["zap"];
  return (
    <svg className="w-5 h-5 text-yellow-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

function FeatureCard({ feature }: { feature: HeroFeature }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 bg-yellow-50 rounded-full flex items-center justify-center flex-shrink-0">
        <FeatureIcon icon={feature.icon} />
      </div>
      <div className="flex-1 text-left">
        <div className="text-sm font-bold text-gray-900 mb-1">{feature.label}</div>
        <div className="text-xs text-gray-600">{feature.caption}</div>
      </div>
    </div>
  );
}

export function HomeHero({
  eyebrow = "Trusted by 100+ Restaurants",
  title,
  titleAccent,
  description,
  pricingLabel = "Limited Time Free Trial",
  pricingValue = "$0",
  pricingOriginal = "Originally $49/mo",
  pricingBadge = "Free Trial Included",
  features = [],
  inputPlaceholder = "Enter your restaurant name",
  primaryCta,
}: HomeHeroProps) {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-6 md:px-16 pt-16 pb-24 overflow-hidden bg-white">
      <div className="max-w-7xl mx-auto text-center">
        <div className="mb-10">
          <span className="inline-block px-4 py-1 bg-yellow-50 text-yellow-700 text-xs font-bold uppercase tracking-wider rounded-full">
            {eyebrow}
          </span>
        </div>

        <h1 className="text-4xl md:text-7xl font-extrabold mb-6 tracking-tight text-gradient-hero">
          <span className="block leading-tight">{title}</span>
          {titleAccent && <span className="block leading-tight">{titleAccent}</span>}
        </h1>

        <p className="text-lg md:text-xl text-gray-700 mb-12 max-w-2xl mx-auto leading-relaxed font-light text-center">
          {description}
        </p>

        <div className="mb-12 mx-auto" style={{ maxWidth: 896 }}>
          <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-6 md:px-10 py-8 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center justify-center">
              <div className="text-xs font-bold text-yellow-700 uppercase tracking-wider mb-3">{pricingLabel}</div>
              <div className="flex items-end justify-center mb-2">
                <div className="text-6xl font-extrabold text-gray-900">{pricingValue}</div>
                <div className="text-base font-medium text-gray-600 ml-2 mb-2">/ 7 days</div>
              </div>
              <div className="text-xs text-gray-400 line-through mb-4 text-center">{pricingOriginal}</div>
              <div className="text-center">
                <span className="inline-block px-4 py-2 bg-yellow-50 text-yellow-700 text-xs font-bold uppercase tracking-wide rounded-full">
                  {pricingBadge}
                </span>
              </div>
            </div>

            {features.length >= 2 && (
              <div className="flex flex-col gap-4">
                {features.slice(0, 2).map((f) => <FeatureCard key={f.label} feature={f} />)}
              </div>
            )}

            {features.length >= 4 && (
              <div className="flex flex-col gap-4">
                {features.slice(2, 4).map((f) => <FeatureCard key={f.label} feature={f} />)}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-4 justify-center max-w-2xl mx-auto">
          <div className="relative flex-1 w-full">
            <input
              type="text"
              placeholder={inputPlaceholder}
              className="w-full px-6 py-5 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
              autoComplete="off"
            />
          </div>
          <a
            href={primaryCta.href}
            rel={primaryCta.external ? "noopener noreferrer" : undefined}
            target={primaryCta.external ? "_blank" : undefined}
            className="px-8 py-5 bg-yellow-400 text-yellow-900 font-bold text-base rounded-lg shadow-lg shadow-yellow-400/20 hover:bg-yellow-500 whitespace-nowrap transition-colors"
          >
            {primaryCta.label}
          </a>
        </div>

        <div className="mt-16 text-sm text-gray-400">&darr; Scroll to explore</div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Create ValueProp**

`src/components/website/sections/ValueProp.tsx`:

```tsx
interface ValuePropProps {
  title: string;
  titleAccent?: string;
  description: string;
  cta?: { label: string; href: string; external?: boolean };
}

export function ValueProp({ title, titleAccent, description, cta }: ValuePropProps) {
  return (
    <section className="relative bg-gray-100 px-6 md:px-16 py-24">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-5xl md:text-7xl font-bold mb-8 tracking-tight max-w-3xl">
          <span className="text-gray-900 block leading-tight">{title}</span>
          {titleAccent && <span className="text-yellow-400 block leading-tight">{titleAccent}</span>}
        </h2>

        <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-2xl leading-relaxed">
          {description}
        </p>

        {cta && (
          <a
            href={cta.href}
            rel={cta.external ? "noopener noreferrer" : undefined}
            target={cta.external ? "_blank" : undefined}
            className="inline-block px-8 py-4 bg-yellow-400 text-yellow-900 font-bold text-lg rounded-lg shadow-lg shadow-yellow-400/20 hover:bg-yellow-500 transition-colors"
          >
            {cta.label}
          </a>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Create VoiceAgent**

`src/components/website/sections/VoiceAgent.tsx`:

```tsx
interface Bullet {
  label: string;
}

interface VoiceAgentProps {
  eyebrow?: string;
  title: string;
  titleAccent?: string;
  description: string;
  bullets: Bullet[];
  agentName?: string;
  primaryCta?: { label: string; href: string; external?: boolean };
  secondaryCta?: { label: string; href: string; external?: boolean };
}

function CtaLink({ cta, className, children }: { cta: { href: string; external?: boolean }; className: string; children: React.ReactNode }) {
  return (
    <a
      href={cta.href}
      rel={cta.external ? "noopener noreferrer" : undefined}
      target={cta.external ? "_blank" : undefined}
      className={className}
    >
      {children}
    </a>
  );
}

export function VoiceAgent({
  eyebrow = "Human-Parity",
  title,
  titleAccent,
  description,
  bullets,
  agentName = "Ava",
  primaryCta,
  secondaryCta,
}: VoiceAgentProps) {
  return (
    <section id="voice-agent" className="relative bg-gray-50 px-6 md:px-16 py-24">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Left Content */}
        <div className="md:col-span-6 flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-px bg-yellow-400" />
            <span className="text-xs font-bold text-yellow-500 uppercase tracking-widest">{eyebrow}</span>
          </div>

          <h2 className="text-3xl md:text-5xl font-semibold mb-6 leading-tight">
            <span className="block text-gray-900">{title}</span>
            {titleAccent && <span className="block text-gray-900">{titleAccent}</span>}
          </h2>

          <p className="text-lg text-gray-600 mb-8 leading-relaxed">{description}</p>

          <div className="space-y-4">
            {bullets.map((b) => (
              <div key={b.label} className="flex items-center gap-3">
                <svg className="w-5 h-5 text-yellow-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
                <span className="text-base font-medium text-gray-900">{b.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Interactive Card */}
        <div className="md:col-span-6 flex items-center justify-center">
          <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-8 max-w-md w-full relative">
            <div className="absolute -top-3 -right-3 bg-yellow-400 text-yellow-900 text-xs font-extrabold px-3 py-1 rounded-full shadow-md flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-700 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-700" />
              </span>
              LIVE
            </div>

            <div className="flex items-center gap-4 mb-8">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center border-2 border-yellow-400/30">
                <svg className="w-7 h-7 text-yellow-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" x2="12" y1="19" y2="22" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Speak with {agentName}</h3>
                <div className="flex items-center gap-2 text-yellow-600">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M2 10v3" /><path d="M6 6v11" /><path d="M10 3v18" /><path d="M14 8v7" /><path d="M18 5v13" /><path d="M22 10v3" />
                  </svg>
                  <span className="text-xs font-semibold uppercase tracking-wider">Hearing is Believing</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-100 rounded-2xl p-6 mb-8">
              <div className="flex items-end justify-center gap-1.5 h-14 mb-3" aria-hidden="true">
                {[30, 60, 90, 45, 75, 35, 55].map((h, i) => (
                  <div key={i} className="w-1 bg-yellow-400 rounded-full animate-pulse" style={{ height: `${h}%`, animationDelay: `${i * 50}ms` }} />
                ))}
              </div>
              <p className="text-sm text-gray-600 text-center">&ldquo;How can I help you with your order today?&rdquo;</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {primaryCta && (
                <CtaLink cta={primaryCta} className="bg-yellow-400 text-yellow-900 font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 hover:bg-yellow-500 transition-colors text-sm">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  {primaryCta.label}
                </CtaLink>
              )}
              {secondaryCta && (
                <CtaLink cta={secondaryCta} className="bg-gray-200 text-gray-900 font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 hover:bg-gray-300 transition-colors text-sm">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="16 2 16 8 22 8" /><line x1="22" x2="16" y1="2" y2="8" />
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  {secondaryCta.label}
                </CtaLink>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/website/sections/HomeHero.tsx src/components/website/sections/ValueProp.tsx src/components/website/sections/VoiceAgent.tsx
git commit -m "feat(website): add HomeHero, ValueProp, VoiceAgent sections"
```

---

## Task 5: Home Page Sections (Part 2 — AutoPilot, DarkChatSection, Testimonials, CTACard)

**Files:**
- Create: `src/components/website/sections/AutoPilot.tsx`
- Create: `src/components/website/sections/DarkChatSection.tsx`
- Create: `src/components/website/sections/Testimonials.tsx`
- Create: `src/components/website/sections/CTACard.tsx`

- [ ] **Step 1: Create AutoPilot**

`src/components/website/sections/AutoPilot.tsx` — Convert directly from the Astro source. Key structure: eyebrow + title + description header, then 3-column card grid with icon + title + description + rich bottom content (seo/review/instagram mockups). All inline SVG icons preserved. Use the exact same Tailwind classes from the Astro source but with JSX syntax (`className`, `strokeWidth`, self-closing tags).

Reference source: `../website-ava/src/components/sections/AutoPilot.astro` (121 lines)

- [ ] **Step 2: Create DarkChatSection**

`src/components/website/sections/DarkChatSection.tsx` — Convert from Astro. Key structure: dark bg (gray-900), 2-column layout (text left, chat card right with glow effect). The suggestion icons use `dangerouslySetInnerHTML` to render SVG paths — instead, define the 3 icon path arrays inline and render them as JSX `<path>` elements.

Reference source: `../website-ava/src/components/sections/DarkChatSection.astro` (78 lines)

- [ ] **Step 3: Create Testimonials**

`src/components/website/sections/Testimonials.tsx` — Convert from Astro. Key structure: left heading + featured quote with yellow border-left, right side with testimonial cards (star ratings + quote + author).

Reference source: `../website-ava/src/components/sections/Testimonials.astro` (57 lines)

- [ ] **Step 4: Create CTACard**

`src/components/website/sections/CTACard.tsx` — Convert from Astro. Key structure: light/dark variant CTA card with title + description + button. Uses `siteConfig.cta.secondary` as default CTA.

Reference source: `../website-ava/src/components/sections/CTACard.astro` (47 lines)

- [ ] **Step 5: Create Home Page**

`src/app/(website)/page.tsx`:

```tsx
import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { HomeHero } from "@/components/website/sections/HomeHero";
import { ValueProp } from "@/components/website/sections/ValueProp";
import { VoiceAgent } from "@/components/website/sections/VoiceAgent";
import { AutoPilot } from "@/components/website/sections/AutoPilot";
import { DarkChatSection } from "@/components/website/sections/DarkChatSection";
import { Testimonials } from "@/components/website/sections/Testimonials";
import { CTACard } from "@/components/website/sections/CTACard";

export const metadata: Metadata = {
  title: `${siteConfig.name} — ${siteConfig.tagline}`,
  description: siteConfig.description,
  openGraph: {
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
    images: [siteConfig.ogImage],
    type: "website",
  },
};

const heroFeatures = [
  { icon: "mic", label: "Humanlike voice", caption: "Natural conversational AI customers love." },
  { icon: "clock", label: "24/7 Availability", caption: "Always on, never sleeps or takes breaks." },
  { icon: "phone-forwarded", label: "Multi-line VoIP", caption: "No busy signals. Unlimited concurrency." },
  { icon: "zap", label: "Instant Setup", caption: "Get started in minutes, not hours." },
];

const voiceBullets = [
  { label: "99.9%+ success rates" },
  { label: "Industrial-grade stability" },
  { label: "Ultra-low latency" },
];

const autoPilotCards = [
  {
    title: "Local SEO Agent",
    description: '"Your GBP Profile has been completed. Google Search traffic grew by 50% over the last 30 days."',
    richContent: "seo" as const,
  },
  {
    title: "Review Agent",
    description: '"New negative review detected. I have drafted a reply for you. If you think it\'s fine, just click send and it will be synced to Google."',
    richContent: "review" as const,
  },
  {
    title: "Instagram Agent",
    description: '"Today\'s new dish have been posted. You can check it out."',
    richContent: "instagram" as const,
  },
];

const chatSuggestions = [
  "Analyze Friday's labor costs vs. revenue",
  "Draft a new seasonal beverage menu post",
  "Summarize guest feedback from last night",
];

const testimonials = [
  {
    quote: "The AI voice agent handles our peak lunch rush perfectly. We've seen a 22% increase in ticket volume simply because we never miss a call anymore.",
    author: "Marcus",
  },
  {
    quote: "Game changer for our small team. The manager agent helps us make data-driven decisions without needing a full analytics department.",
    author: "Sarah Chen",
  },
];

export default function HomePage() {
  return (
    <>
      <HomeHero
        eyebrow="Trusted by 100+ Restaurants"
        title="You are losing orders Due to"
        titleAccent="missed calls."
        description="See how many orders you're losing on the phone. AI audits your call quality and stop negative reviews before they happen."
        features={heroFeatures}
        primaryCta={{ label: "Start a 7-Day Free Trial", href: siteConfig.cta.primary.href }}
      />
      <ValueProp
        title="Your Agentic"
        titleAccent="Restaurant Partner"
        description="The intelligent partner for modern restaurateurs and local entrepreneurs. While you focus on the craft of service and your guests, our AI agents handle the digital heavy lifting."
        cta={{ label: "Get a Free Demo", href: siteConfig.cta.secondary.href }}
      />
      <VoiceAgent
        eyebrow="Human-Parity"
        title="An AI Voice Agent"
        titleAccent="Speak like your best host"
        description="Capture every reservation, answer every inquiry, and never let a busy hour cost you a guest."
        bullets={voiceBullets}
        agentName="Ava"
        primaryCta={{ label: "Call Agent", href: siteConfig.cta.secondary.href }}
        secondaryCta={{ label: "Get a Call", href: siteConfig.cta.secondary.href }}
      />
      <AutoPilot
        eyebrow="Hands-free Growth"
        title="Your marketing on Auto pilot"
        description="AI manages your entire digital presence. From Google Search to instagram post"
        cards={autoPilotCards}
      />
      <DarkChatSection
        eyebrow="Agentic Manager"
        title="Run restaurant operations in natural language"
        description="The intelligent partner for modern hospitality. Our agent handles the operational heavy lifting while you focus on the floor."
        suggestions={chatSuggestions}
        workspaceName="LocalGrow Manager"
      />
      <Testimonials
        title="Voices from"
        titleBreak="the Floor"
        featuredQuote="Finally, a technology that feels like it was built by people who have actually runned a restaurant"
        items={testimonials}
      />
      <CTACard
        variant="light"
        title="Unlock your AI partner for hospitality now!"
        description="Join hundreds of restaurants already saving time and increasing revenue with AI agents."
        cta={{ label: "Try it Free Demo", href: siteConfig.cta.secondary.href }}
      />
    </>
  );
}
```

- [ ] **Step 6: Verify dev server — visit http://localhost:3000/**

Expected: Full home page renders with all sections. Check mobile responsiveness.

- [ ] **Step 7: Commit**

```bash
git add src/components/website/sections/ src/app/\(website\)/page.tsx
git commit -m "feat(website): add home page with all sections"
```

---

## Task 6: Shared Page Sections (Hero, PricingTable, FAQ, MissionBlock, ValuesGrid, Timeline, ImageBlock)

**Files:**
- Create: `src/components/website/sections/Hero.tsx`
- Create: `src/components/website/sections/PricingTable.tsx`
- Create: `src/components/website/sections/FAQ.tsx`
- Create: `src/components/website/sections/MissionBlock.tsx`
- Create: `src/components/website/sections/ValuesGrid.tsx`
- Create: `src/components/website/sections/Timeline.tsx`
- Create: `src/components/website/sections/ImageBlock.tsx`

Convert each component from its Astro source. Key notes:

- **Hero**: uses Section, Container, Badge, WebsiteButton. Has a radial gradient amber overlay. Supports eyebrow, title, titleAccent, description, CTAs, variant (default/warm).
- **PricingTable**: uses Section, Container, WebsiteButton, Badge, Icon. Tab bar + 3-column pricing cards. Highlighted plan gets glow shadow.
- **FAQ**: client component (`"use client"`) — uses `<details>` element which works natively, but if you want controlled state for animations, make it a client component. Actually `<details>` works without JS, so keep as server component.
- **MissionBlock**: simple centered text in Section/Container.
- **ValuesGrid**: 3-column grid with label + description.
- **Timeline**: split or stacked layout with year dots.
- **ImageBlock**: gradient placeholder or image with aspect ratio.

Reference sources in `../website-ava/src/components/sections/`:
- `Hero.astro` (81 lines)
- `PricingTable.astro` (112 lines)
- `FAQ.astro` (82 lines)
- `MissionBlock.astro` (20 lines)
- `ValuesGrid.astro` (31 lines)
- `Timeline.astro` (66 lines)
- `ImageBlock.astro` (43 lines)

- [ ] **Step 1: Create all 7 components** — one file each, mechanical JSX conversion from Astro templates.

- [ ] **Step 2: Commit**

```bash
git add src/components/website/sections/
git commit -m "feat(website): add shared sections (Hero, PricingTable, FAQ, MissionBlock, ValuesGrid, Timeline, ImageBlock)"
```

---

## Task 7: Pricing Page + About Page

**Files:**
- Create: `src/app/(website)/pricing/page.tsx`
- Create: `src/app/(website)/about/page.tsx`

- [ ] **Step 1: Create Pricing page**

`src/app/(website)/pricing/page.tsx` — data from `../website-ava/src/pages/pricing.astro`:

```tsx
import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { Hero } from "@/components/website/sections/Hero";
import { PricingTable } from "@/components/website/sections/PricingTable";
import { FAQ } from "@/components/website/sections/FAQ";
import { CTACard } from "@/components/website/sections/CTACard";

export const metadata: Metadata = {
  title: `Pricing — ${siteConfig.name}`,
  description: "Simple plans that pay for themselves the first week you are live.",
};

const plans = [
  {
    name: "Starter",
    price: "$0",
    period: "/ month",
    description: "Try the voice partner for a single location, free forever.",
    features: [
      "100 calls included per month",
      "Standard voice agent",
      "Email confirmations only",
      "Community support",
    ],
    cta: { label: "Start a Free Trial", href: siteConfig.cta.primary.href },
    ctaVariant: "secondary" as const,
  },
  {
    name: "Pro",
    price: "$249",
    period: "/ month",
    description: "Everything a single location needs to stop losing calls.",
    features: [
      "Up to 1,500 calls per month",
      "Reservations and takeout",
      "Email and SMS confirmations",
      "Analytics dashboard",
      "Business-hours support",
    ],
    cta: { label: "Get Pro Now", href: siteConfig.cta.primary.href },
    ctaVariant: "primary" as const,
    highlighted: true,
  },
  {
    name: "Growth",
    price: "$449",
    period: "/ month",
    description: "Multi-location hospitality brands with serious call volume.",
    features: [
      "Everything in Pro",
      "Unlimited calls",
      "Multi-location routing",
      "POS integration",
      "Priority human handoff",
      "Dedicated success manager",
    ],
    cta: { label: "Talk to Sales", href: siteConfig.cta.secondary.href },
    ctaVariant: "dark" as const,
  },
];

const faqs = [
  { question: "What is Ordering Agent?", answer: "The Ordering Agent is plugged in to your phone lines to convert inbound orders automatically, talking with guests in natural language." },
  { question: "Does the Ordering Agent support multiple languages?", answer: "Yes. English and Spanish are included on all plans. Additional languages are available on request for Pro and Growth customers." },
  { question: "Can I cancel anytime?", answer: "Yes — monthly billing, cancel with a single click from your dashboard." },
  { question: "Does cancellation work with my POS?", answer: "We integrate with the major hospitality POS systems via a pre-built connector. Custom integrations take about a week." },
  { question: "Is there a setup fee?", answer: "No. Setup is included with every plan." },
  { question: "What kind of support is provided?", answer: "All plans get community + email support. Pro plans add business-hours support. Growth plans get a dedicated success manager." },
];

export default function PricingPage() {
  return (
    <>
      <Hero title="Prices" description="" variant="warm" />
      <PricingTable plans={plans} tabs={["Free Plan", "Growth Plan", "Manage Agent"]} activeTab="Free Plan" />
      <FAQ
        title="Frequently Asked"
        titleBreak="Questions"
        description="Everything you need to know about Localgrow pricing and plans."
        items={faqs}
        variant="default"
        layout="split"
      />
      <CTACard variant="dark" title="Unlock your AI partner for hospitality now!" />
    </>
  );
}
```

- [ ] **Step 2: Create About page**

`src/app/(website)/about/page.tsx` — data from `../website-ava/src/pages/about.astro`. Same pattern: metadata + data constants + component composition. Include Hero, MissionBlock, ValuesGrid, ImageBlock, Timeline, CTACard.

- [ ] **Step 3: Verify both pages in browser**

```
http://localhost:3000/pricing
http://localhost:3000/about
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(website\)/pricing/ src/app/\(website\)/about/
git commit -m "feat(website): add pricing and about pages"
```

---

## Task 8: Content System (MDX Pipeline + Blog + Releases)

**Files:**
- Modify: `next.config.ts` (add MDX support)
- Create: `src/content/blog/welcome-to-localgrow.mdx`
- Create: `src/content/blog/restaurant-ai-call-handling.mdx`
- Create: `src/content/releases/spring-2024.md`
- Create: `src/content/releases/winter-2024.md`
- Create: `src/content/releases/connectivity-update.md`
- Create: `src/lib/content.ts`
- Create: `src/components/website/sections/BlogGrid.tsx`
- Create: `src/components/website/sections/ArticleLayout.tsx`
- Create: `src/components/website/sections/ReleaseTimeline.tsx`
- Create: `src/app/(website)/blog/page.tsx`
- Create: `src/app/(website)/blog/[slug]/page.tsx`
- Create: `src/app/(website)/releases/page.tsx`

- [ ] **Step 1: Copy content files from website-ava**

```bash
mkdir -p src/content/blog src/content/releases
cp ../website-ava/src/content/blog/welcome-to-localgrow.mdx src/content/blog/
cp ../website-ava/src/content/blog/restaurant-ai-call-handling.mdx src/content/blog/
cp ../website-ava/src/content/releases/spring-2024.md src/content/releases/
cp ../website-ava/src/content/releases/winter-2024.md src/content/releases/
cp ../website-ava/src/content/releases/connectivity-update.md src/content/releases/
```

- [ ] **Step 2: Create content utility**

`src/lib/content.ts`:

```typescript
import fs from "fs";
import path from "path";
import matter from "gray-matter";

const CONTENT_DIR = path.join(process.cwd(), "src/content");

interface BlogFrontmatter {
  title: string;
  description: string;
  date: string;
  author: { name: string; role?: string };
  tags: string[];
  draft: boolean;
}

interface ReleaseFrontmatter {
  version: string;
  date: string;
  title: string;
  category: "feature" | "improvement" | "fix";
  highlights: string[];
  draft: boolean;
}

export interface BlogPost {
  slug: string;
  frontmatter: BlogFrontmatter;
  content: string;
}

export interface Release {
  slug: string;
  frontmatter: ReleaseFrontmatter;
  content: string;
}

function getFiles(dir: string): string[] {
  const fullPath = path.join(CONTENT_DIR, dir);
  if (!fs.existsSync(fullPath)) return [];
  return fs.readdirSync(fullPath).filter((f) => f.endsWith(".md") || f.endsWith(".mdx"));
}

export function getAllPosts(): BlogPost[] {
  const files = getFiles("blog");
  return files
    .map((filename) => {
      const filePath = path.join(CONTENT_DIR, "blog", filename);
      const raw = fs.readFileSync(filePath, "utf-8");
      const { data, content } = matter(raw);
      const slug = filename.replace(/\.(mdx?|md)$/, "");
      return {
        slug,
        frontmatter: data as BlogFrontmatter,
        content,
      };
    })
    .filter((p) => !p.frontmatter.draft || process.env.NODE_ENV !== "production")
    .sort((a, b) => new Date(b.frontmatter.date).getTime() - new Date(a.frontmatter.date).getTime());
}

export function getPost(slug: string): BlogPost | undefined {
  const posts = getAllPosts();
  return posts.find((p) => p.slug === slug);
}

export function getAllReleases(): Release[] {
  const files = getFiles("releases");
  return files
    .map((filename) => {
      const filePath = path.join(CONTENT_DIR, "releases", filename);
      const raw = fs.readFileSync(filePath, "utf-8");
      const { data, content } = matter(raw);
      const slug = filename.replace(/\.md$/, "");
      return {
        slug,
        frontmatter: data as ReleaseFrontmatter,
        content,
      };
    })
    .filter((r) => !r.frontmatter.draft || process.env.NODE_ENV !== "production")
    .sort((a, b) => new Date(b.frontmatter.date).getTime() - new Date(a.frontmatter.date).getTime());
}
```

- [ ] **Step 3: Create BlogGrid section**

`src/components/website/sections/BlogGrid.tsx` — Convert from `../website-ava/src/components/sections/BlogGrid.astro`. Uses `BlogPost` type from content utils. Renders a 3-column grid of post cards with date, title, description, author.

- [ ] **Step 4: Create ArticleLayout section**

`src/components/website/sections/ArticleLayout.tsx` — Convert from `../website-ava/src/components/sections/ArticleLayout.astro`. Centered article header + Prose wrapper for content.

- [ ] **Step 5: Create ReleaseTimeline section**

`src/components/website/sections/ReleaseTimeline.tsx` — Convert from `../website-ava/src/components/sections/ReleaseTimeline.astro`. Two-column layout with date + title + highlights. First release gets a featured image placeholder.

- [ ] **Step 6: Create blog listing page**

`src/app/(website)/blog/page.tsx`:

```tsx
import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { getAllPosts } from "@/lib/content";
import { Hero } from "@/components/website/sections/Hero";
import { BlogGrid } from "@/components/website/sections/BlogGrid";
import { CTACard } from "@/components/website/sections/CTACard";

export const metadata: Metadata = {
  title: `Blog — ${siteConfig.name}`,
  description: "Perspectives, product updates, and playbooks from the Localgrow team.",
};

export default function BlogPage() {
  const posts = getAllPosts();
  return (
    <>
      <Hero
        eyebrow="Insights"
        title="Field notes from the"
        titleAccent="hospitality frontier."
        description="How restaurants are rebuilding operations for the agentic era."
      />
      <BlogGrid posts={posts} />
      <CTACard />
    </>
  );
}
```

- [ ] **Step 7: Create blog post page**

`src/app/(website)/blog/[slug]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { getAllPosts, getPost } from "@/lib/content";
import { ArticleLayout } from "@/components/website/sections/ArticleLayout";
import { CTACard } from "@/components/website/sections/CTACard";
import { Prose } from "@/components/website/ui/Prose";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  return {
    title: `${post.frontmatter.title} — ${siteConfig.name}`,
    description: post.frontmatter.description,
    openGraph: {
      title: post.frontmatter.title,
      description: post.frontmatter.description,
      type: "article",
      publishedTime: post.frontmatter.date,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  return (
    <>
      <ArticleLayout
        title={post.frontmatter.title}
        description={post.frontmatter.description}
        date={post.frontmatter.date}
        author={post.frontmatter.author}
      >
        <Prose>
          {/* Render markdown content — for MDX we need dynamic import or remark processing */}
          <div dangerouslySetInnerHTML={{ __html: post.content }} />
        </Prose>
      </ArticleLayout>
      <CTACard />
    </>
  );
}
```

Note: `dangerouslySetInnerHTML` only works for plain HTML. Since the content is MDX/Markdown, use `next-mdx-remote` (already installed in Step 1) to render it properly. Replace the `dangerouslySetInnerHTML` block with:

```tsx
import { MDXRemote } from "next-mdx-remote/rsc";

// Inside the component, replace dangerouslySetInnerHTML with:
<Prose>
  <MDXRemote source={post.content} />
</Prose>
```

- [ ] **Step 8: Create releases page**

`src/app/(website)/releases/page.tsx`:

```tsx
import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { getAllReleases } from "@/lib/content";
import { Hero } from "@/components/website/sections/Hero";
import { ReleaseTimeline } from "@/components/website/sections/ReleaseTimeline";

export const metadata: Metadata = {
  title: `Release Notes — ${siteConfig.name}`,
  description: "What we shipped, when, and why it matters.",
};

export default function ReleasesPage() {
  const releases = getAllReleases();
  return (
    <>
      <Hero
        eyebrow="Changelog"
        title="Release Notes"
        description="Stay updated with the latest improvements, new features, and technical enhancements we've brought to Localgrow."
        variant="default"
      />
      <ReleaseTimeline releases={releases} />
    </>
  );
}
```

- [ ] **Step 9: Verify all content pages in browser**

```
http://localhost:3000/blog
http://localhost:3000/blog/welcome-to-localgrow
http://localhost:3000/releases
```

- [ ] **Step 10: Commit**

```bash
git add src/content/ src/lib/content.ts src/components/website/sections/BlogGrid.tsx src/components/website/sections/ArticleLayout.tsx src/components/website/sections/ReleaseTimeline.tsx src/app/\(website\)/blog/ src/app/\(website\)/releases/
git commit -m "feat(website): add blog + releases with MDX content pipeline"
```

---

## Task 9: Dashboard Theme — Fix to Amber

**Files:**
- Modify: `src/types/theme.ts`
- Modify: Dashboard layout or theme provider (wherever theme CSS variables are injected)

- [ ] **Step 1: Add amber preset to theme.ts**

Add to `THEME_PRESETS` in `src/types/theme.ts`:

```typescript
amber: {
  primary: {
    base: "45 100% 48%",     // #f5b800 in HSL
    hover: "38 100% 35%",    // #b27900 in HSL (amber-700)
    light: "45 100% 97%",    // #fffaeb (amber-50)
    foreground: "0 0% 100%", // white
  },
},
```

- [ ] **Step 2: Change DEFAULT_THEME to amber**

```typescript
export const DEFAULT_THEME: ThemeConfig = {
  primary: {
    base: "45 100% 48%",
    hover: "38 100% 35%",
    light: "45 100% 97%",
    foreground: "0 0% 100%",
  },
};
```

- [ ] **Step 3: Update globals.css default theme variables**

In `src/app/globals.css`, update the default theme CSS variables:

```css
/* Theme colors - defaults (amber — unified with website) */
--theme-primary: 45 100% 48%;
--theme-primary-hover: 38 100% 35%;
--theme-primary-light: 45 100% 97%;
--theme-primary-foreground: 0 0% 100%;
```

- [ ] **Step 4: Remove dynamic theme selection from Dashboard** (if applicable)

Search for any code that dynamically sets theme variables based on tenant config and remove/simplify it for dashboard routes.

- [ ] **Step 5: Verify dashboard still works**

```
http://localhost:3000/dashboard/login
```

Expected: Dashboard UI elements (buttons, links, highlights) now use amber/yellow instead of red.

- [ ] **Step 6: Commit**

```bash
git add src/types/theme.ts src/app/globals.css
git commit -m "feat: unify dashboard theme to amber/yellow, matching website brand"
```

---

## Task 10: Final Verification & Cleanup

- [ ] **Step 1: Full build**

```bash
npm run build
```

Expected: No build errors. All pages statically generated.

- [ ] **Step 2: Run existing tests**

```bash
npm run test:run
```

Expected: All existing tests pass (no regressions from route rename).

- [ ] **Step 3: Run linter**

```bash
npm run lint
```

Expected: No new lint errors.

- [ ] **Step 4: Manual smoke test** — visit all pages in dev server:

- `/` — Home page with all sections
- `/pricing` — Pricing table + FAQ
- `/about` — About with timeline
- `/blog` — Blog listing
- `/blog/welcome-to-localgrow` — Blog article
- `/releases` — Release timeline
- `/calculator` — Existing tool (should have website layout)
- `/dashboard/login` — Dashboard login (should have amber theme)
- Mobile responsiveness for all pages

- [ ] **Step 5: Commit any remaining fixes**

```bash
git add -A
git commit -m "chore: final cleanup for website-ava migration"
```
