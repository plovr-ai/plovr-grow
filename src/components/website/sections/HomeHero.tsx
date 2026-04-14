import { siteConfig } from "@/config/site";

interface HomeHeroProps {
  badge?: string;
  title: string;
  titleHighlight?: string;
  subtitle: string;
  agentName?: string;
  agentSubtitle?: string;
  callCta?: { label: string; href: string; external?: boolean };
  talkCta?: { label: string; href: string; external?: boolean };
  demoCta?: { label: string; href: string; external?: boolean };
}

export function HomeHero({
  badge = "0 Busy signals",
  title = "Stop Losing Revenue To",
  titleHighlight = "Misses Calls",
  subtitle = "Our AI Voice Agent that handles 100% of your phone orders with human-like precision, 24/7.",
  agentName = "Ava",
  agentSubtitle = "Hearing is believing",
  callCta = { label: "Call Me", href: siteConfig.cta.secondary.href, external: true },
  talkCta = { label: "Talk Now", href: siteConfig.cta.secondary.href, external: true },
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
        <h1 className="relative max-w-5xl text-center font-extrabold leading-none tracking-tight">
          <span className="block text-5xl text-ws-text-heading md:text-7xl lg:text-[96px] lg:leading-[96px]">
            {title}
          </span>
          {titleHighlight && (
            <span className="relative mt-1 block text-5xl text-[#ffbf00] md:text-7xl lg:text-[96px] lg:leading-[96px]">
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-1 h-3 bg-[rgba(255,191,0,0.2)] md:bottom-2"
              />
              <span className="relative">{titleHighlight}</span>
            </span>
          )}
        </h1>

        {/* Subtitle */}
        <p className="mt-6 max-w-2xl text-center text-lg font-light leading-8 text-ws-text-body md:text-2xl">
          {subtitle}
        </p>

        {/* Speak with Ava Module */}
        <div className="relative mt-12 w-full max-w-4xl rounded-[48px] bg-white/70 shadow-[0px_10px_40px_0px_rgba(255,191,0,0.12)] backdrop-blur-sm">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[48px] border border-[rgba(225,212,191,0.3)]"
          />
          <div className="flex flex-col gap-12 p-8 md:p-14">
            {/* Top row: Agent info + buttons */}
            <div className="flex flex-col items-center justify-between gap-8 md:flex-row">
              {/* Agent identity */}
              <div className="flex items-center gap-8">
                {/* Avatar with glow */}
                <div className="relative shrink-0">
                  <div className="absolute inset-0 rounded-full bg-[rgba(255,191,0,0.3)]" />
                  <div className="relative flex size-20 items-center justify-center rounded-full border border-[rgba(255,191,0,0.2)] bg-white shadow-xl">
                    {/* Phone icon */}
                    <svg
                      className="size-7 text-[#ffbf00]"
                      viewBox="0 0 27 30"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M26.28 21.09l-5.72-2.86a1.71 1.71 0 00-2 .5l-2.53 3.09a13.24 13.24 0 01-6.33-6.33l3.09-2.53a1.7 1.7 0 00.5-2L10.43.24A1.72 1.72 0 008.47.05L1.33 1.48A1.71 1.71 0 000 3.14 25.72 25.72 0 0025.71 28.86a1.71 1.71 0 001.67-1.33l1.43-7.14a1.73 1.73 0 00-.53-1.9z" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-extrabold tracking-tight text-ws-text-heading md:text-3xl">
                    Speak with {agentName}
                  </h3>
                  <p className="mt-1 text-base font-medium text-ws-text-body opacity-70">
                    {agentSubtitle}
                  </p>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex items-center gap-5">
                {callCta && (
                  <a
                    href={callCta.href}
                    rel={callCta.external ? "noopener noreferrer" : undefined}
                    target={callCta.external ? "_blank" : undefined}
                    className="relative flex items-center gap-3 rounded-2xl bg-white px-8 py-4 font-bold text-ws-text-heading transition-colors hover:bg-gray-50"
                  >
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 rounded-2xl border border-[rgba(225,212,191,0.5)]"
                    />
                    {/* Phone icon */}
                    <svg
                      className="size-[18px] text-[#ffbf00]"
                      viewBox="0 0 18.4 18.4"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M17.45 13.52L13.1 11.34a1.16 1.16 0 00-1.34.34L10.08 13.74a8.87 8.87 0 01-4.23-4.23l2.06-1.69a1.14 1.14 0 00.34-1.34L6.07.13A1.15 1.15 0 004.73.01L.9.99A1.15 1.15 0 000 2.13 16.27 16.27 0 0016.27 18.4a1.15 1.15 0 001.14-.9l.98-3.83a1.16 1.16 0 00-.94-1.15z" />
                    </svg>
                    {callCta.label}
                  </a>
                )}
                {talkCta && (
                  <a
                    href={talkCta.href}
                    rel={talkCta.external ? "noopener noreferrer" : undefined}
                    target={talkCta.external ? "_blank" : undefined}
                    className="flex items-center gap-3 rounded-2xl bg-[#1c1b1b] px-8 py-4 font-bold text-white shadow-xl transition-colors hover:bg-[#2c2b2b]"
                  >
                    {/* Headphone icon */}
                    <svg
                      className="size-[22px]"
                      viewBox="0 0 14 22"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M7 0a7 7 0 00-7 7v8a7 7 0 007 7 7 7 0 007-7V7a7 7 0 00-7-7zm5 15a5 5 0 01-10 0V7a5 5 0 0110 0v8z" />
                    </svg>
                    {talkCta.label}
                  </a>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="flex flex-col gap-4">
              <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-[#f3f4f6]">
                <div className="absolute inset-y-0 left-0 right-[60%] rounded-full bg-gradient-to-r from-[#ffbf00] via-[rgba(255,191,0,0.6)] to-[#ffbf00] shadow-[0px_0px_10px_0px_rgba(255,191,0,0.4)]" />
              </div>
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <div className="size-1.5 rounded-full bg-green-500" />
                  <span className="text-[11px] font-bold uppercase tracking-[2.2px] text-ws-text-body/40">
                    Ready to assist
                  </span>
                </div>
                <span className="text-[11px] font-bold uppercase tracking-[2.2px] text-ws-text-body/40">
                  Live Audio Stream
                </span>
              </div>
            </div>
          </div>
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
