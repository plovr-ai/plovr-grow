import { siteConfig } from "@/config/site";
import { CallDemoCard } from "./CallDemoCard";

interface HomeHeroProps {
  badge?: string;
  title?: string;
  titleHighlight?: string;
  subtitle?: string;
  demoCta?: { label: string; href: string; external?: boolean };
}

export function HomeHero({
  badge = "0 Busy signals",
  title = "Stop Losing Revenue To",
  titleHighlight = "Missed Calls",
  subtitle = "Our AI Voice Agent that handles 100% of your phone orders with human-like precision, 24/7.",
  demoCta = { label: "Get a Free Demo", href: siteConfig.cta.secondary.href, external: true },
}: HomeHeroProps) {
  return (
    <section className="relative bg-ws-bg-page px-6 md:px-8">
      <div className="mx-auto flex max-w-5xl flex-col items-center pt-16 pb-12">
        {/* Badge */}
        <div className="relative mb-6 inline-flex items-center justify-center rounded-full bg-[rgba(121,89,0,0.05)] px-5 py-2">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full border border-[rgba(121,89,0,0.2)]"
          />
          <span className="text-[10px] font-bold uppercase tracking-[2.5px] text-ws-text-amber">
            {badge}
          </span>
        </div>

        {/* Title */}
        <h1 className="relative max-w-5xl text-center text-5xl font-extrabold leading-tight tracking-tight md:text-7xl lg:text-[96px] lg:leading-[1.1]">
          <span className="text-ws-text-heading">{title} </span>
          {titleHighlight && (
            <span className="relative inline text-[#ffbf00]">
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-2 bg-[rgba(255,191,0,0.2)] md:bottom-1 md:h-3"
              />
              <span className="relative">{titleHighlight}</span>
            </span>
          )}
        </h1>

        {/* Subtitle */}
        <p className="mt-6 max-w-2xl text-center text-lg font-light leading-8 text-ws-text-body md:text-2xl">
          {subtitle}
        </p>

        {/* Conversation demo card */}
        <div className="mt-12 flex w-full justify-center">
          <CallDemoCard />
        </div>

        {/* CTA Button */}
        {demoCta && (
          <a
            href={demoCta.href}
            rel={demoCta.external ? "noopener noreferrer" : undefined}
            target={demoCta.external ? "_blank" : undefined}
            className="mt-14 inline-flex min-w-[280px] items-center justify-center gap-4 rounded-lg bg-primary px-10 py-7 text-xl font-extrabold text-primary-foreground transition-colors hover:bg-primary/90 md:min-w-[340px] md:px-14 md:text-2xl"
          >
            {/* Arrow icon */}
            <svg
              className="size-5"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M10 0L8.59 1.41 16.17 9H0v2h16.17l-7.58 7.59L10 20l10-10L10 0z" />
            </svg>
            {demoCta.label}
          </a>
        )}
      </div>
    </section>
  );
}
