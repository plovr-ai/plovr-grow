# Website-Ava Migration Design

> Migrate the LocalGrow marketing website (website-ava, Astro 4) into plovr-grow (Next.js 16), unifying tech stack, theme, and deployment.

## Context

- **website-ava**: Astro 4 static marketing site for LocalGrow brand. Pages: home, pricing, about, blog (MDX), releases. Amber/yellow theme (#f5b800). Deployed on Cloudflare Pages.
- **plovr-grow**: Next.js 16 multi-tenant restaurant SaaS. Includes dashboard, storefront, admin, and platform tools.
- **Goal**: Merge website-ava into plovr-grow as the platform-level marketing website. Unify theme, auth flow, and deployment.

## Key Decisions

| Decision | Choice |
|---|---|
| Website positioning | Platform-level, independent of multi-tenant system |
| Route structure | Root path (`/`, `/pricing`, `/about`, `/blog`, `/releases`) |
| Route group | Merge into existing `(platform)` → rename to `(website)` |
| Theme | Amber/yellow unified across website + dashboard; storefront keeps dynamic |
| Component migration | Rewrite 31 Astro components to React Server Components |
| Content system | File-driven MDX (no CMS) |
| Auth integration | Login button links to `/dashboard/login` (existing Stytch + NextAuth) |
| Deployment | Unified Next.js deployment; deprecate Cloudflare Pages |
| Brand | LocalGrow (final brand name) |
| i18n | English only for website; no i18n integration |

## 1. Route Structure

Rename `(platform)` route group to `(website)`. New pages coexist with existing platform tools.

```
src/app/
├── (website)/                  # renamed from (platform)
│   ├── layout.tsx              # Website layout (Header + Footer)
│   ├── page.tsx                # Home /
│   ├── pricing/
│   │   └── page.tsx            # /pricing
│   ├── about/
│   │   └── page.tsx            # /about
│   ├── blog/
│   │   ├── page.tsx            # /blog (listing)
│   │   └── [slug]/
│   │       └── page.tsx        # /blog/xxx (article)
│   ├── releases/
│   │   └── page.tsx            # /releases
│   ├── calculator/             # existing, unchanged
│   ├── claim/                  # existing, unchanged
│   ├── customer-loss/          # existing, unchanged
│   └── generator/              # existing, unchanged
├── (dashboard)/                # unchanged
├── (storefront)/               # unchanged
├── (admin)/                    # unchanged
└── api/                        # unchanged
```

- `(website)` is a route group — no URL impact
- Static routes (`/pricing`, `/about`) take priority over dynamic `[companySlug]` in storefront
- Existing platform tools (`/calculator`, `/claim`, etc.) automatically get the website layout (Header/Footer)

## 2. Theme System

### 2.1 Add Amber Theme

Define amber HSL variants in the theme system, based on website-ava's `#f5b800`:

| Variant | Value | Usage |
|---|---|---|
| base | amber-500 HSL | Primary brand color |
| hover | amber-700 HSL | Hover/emphasis states |
| light | amber-50 HSL | Light backgrounds, selected states |
| foreground | white | Text on amber backgrounds |

### 2.2 Dashboard: Fixed Amber

- Remove dynamic theme selection from Dashboard
- Dashboard layout injects amber theme CSS variables directly
- No longer reads theme from tenant configuration

### 2.3 Storefront: Retain Dynamic

- Storefront continues loading theme from tenant config
- Theme system infrastructure (CSS variables, utility classes) stays intact
- Only Dashboard stops using dynamic switching

### 2.4 Font

- Import `Manrope` via `next/font/google` for the website
- Dashboard adopts Manrope as well for visual consistency

## 3. Component Migration

### 3.1 File Organization

```
src/components/website/
├── layout/
│   ├── WebsiteHeader.tsx       # Navigation, dropdown, mobile menu, Login link
│   └── WebsiteFooter.tsx       # Footer with link groups, copyright
├── sections/
│   ├── HomeHero.tsx
│   ├── ValueProp.tsx
│   ├── VoiceAgent.tsx
│   ├── AutoPilot.tsx
│   ├── DarkChatSection.tsx
│   ├── Testimonials.tsx
│   ├── CTACard.tsx
│   ├── PricingTable.tsx
│   ├── FAQ.tsx
│   ├── Hero.tsx
│   ├── MissionBlock.tsx
│   ├── ValuesGrid.tsx
│   ├── Timeline.tsx
│   ├── BlogGrid.tsx
│   ├── ArticleLayout.tsx
│   ├── ReleaseTimeline.tsx
│   ├── FeatureGrid.tsx
│   ├── StatsBar.tsx
│   └── ImageBlock.tsx
└── ui/
    ├── Container.tsx            # Max-width wrapper
    ├── Logo.tsx                 # LocalGrow brand logo
    ├── Prose.tsx                # MDX article typography
    └── Section.tsx              # Page section wrapper
```

### 3.2 Migration Rules

- Astro template → React JSX (mechanical conversion)
- Tailwind v3 classes → Tailwind v4 (mostly compatible, minor adjustments)
- Static content stays hardcoded (English-only, no i18n)
- Interactive parts (mobile menu toggle, FAQ accordion) → `'use client'` components
- SEO: use Next.js `generateMetadata` instead of custom SEO component
- Reuse existing plovr-grow UI components where applicable (Button, Card, Badge, icons via lucide-react)

### 3.3 Static Assets

- Copy `favicon.svg`, `logo.svg`, `og.svg` to `public/`
- Design PNGs in `design/` directory — not migrated (reference only)

## 4. Content System

### 4.1 File Structure

```
src/content/
├── blog/
│   ├── welcome-to-localgrow.mdx
│   └── restaurant-ai-call-handling.mdx
└── releases/
    ├── connectivity-update.md
    ├── winter-2024.md
    └── spring-2024.md
```

### 4.2 Technical Stack

- `@next/mdx` for MDX support in `next.config.ts`
- `gray-matter` for frontmatter parsing
- Utility functions: `getPost(slug)`, `getAllPosts()`, `getAllReleases()`
- `generateStaticParams` for build-time static generation
- `Prose` component for article typography

### 4.3 Frontmatter Schema

```typescript
// Blog
interface BlogFrontmatter {
  title: string;
  description: string;
  cover?: string;
  date: string;
  author: { name: string; avatar?: string; role: string };
  tags: string[];
  draft: boolean;
}

// Release
interface ReleaseFrontmatter {
  version: string;
  date: string;
  title: string;
  category: 'feature' | 'improvement' | 'fix';
  highlights: string[];
  draft: boolean;
}
```

## 5. Authentication Integration

- Website Header Login button → `<Link href="/dashboard/login">`
- All CTA / Sign Up buttons → `/dashboard/login`
- Replace all `app.localgrow.ai/*` external links with internal routes
- No auth state detection on website pages
- No new auth logic

## 6. Deployment

- Unified Next.js deployment (single app)
- Website pages use static rendering (Server Components, no dynamic data)
- After migration complete: deprecate Cloudflare Pages deployment for website-ava
- Domain: `localgrow.ai` points to the unified deployment

## 7. Out of Scope

- Sitemap generation (tracked in #212)
- RSS feed
- Website i18n / multi-language
- CMS / database-backed content
- Independent domain routing (no middleware rewrites needed)

## 8. Dependencies to Install

- `@next/mdx` — MDX support
- `gray-matter` — Frontmatter parsing
- `@tailwindcss/typography` — Prose styling (if not already present)
