import { Suspense } from "react";
import { siteConfig } from "@/config/site";
import { WebsiteButton } from "@/components/website/ui/WebsiteButton";
import { LeadForm } from "@/app/(website)/lp/voice-agent/components/LeadForm";

export function GrowLandingHero() {
  return (
    <section className="relative bg-ws-bg-page px-6 md:px-8">
      <div className="mx-auto grid max-w-6xl gap-12 pt-16 pb-12 lg:grid-cols-[1fr_420px] lg:items-start lg:gap-16">
        {/* Left: Hero content */}
        <div className="flex flex-col">
          {/* Badge */}
          <div className="relative mb-6 inline-flex w-fit items-center justify-center rounded-full bg-[rgba(121,89,0,0.05)] px-5 py-2">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-full border border-[rgba(121,89,0,0.2)]"
            />
            <span className="text-[10px] font-bold uppercase tracking-[2.5px] text-ws-text-amber">
              All Online Channels
            </span>
          </div>

          {/* Title */}
          <h1 className="max-w-xl text-5xl font-extrabold leading-tight tracking-tight md:text-6xl lg:text-7xl">
            <span className="text-ws-text-heading">Your </span>
            <span className="relative inline text-[#ffbf00]">
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-2 bg-[rgba(255,191,0,0.2)] md:bottom-1 md:h-3"
              />
              <span className="relative">AI Growth</span>
            </span>
            <span className="text-ws-text-heading"> Squad. Expertly </span>
            <span className="relative inline text-[#ffbf00]">
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-2 bg-[rgba(255,191,0,0.2)] md:bottom-1 md:h-3"
              />
              <span className="relative">Supervised</span>
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 max-w-lg text-lg font-light leading-8 text-ws-text-body md:text-xl">
            From SEO to Social Media, our specialized agents manage your entire
            online presence to drive consistent foot traffic and reclaim your
            margins.
          </p>

          {/* CTA */}
          <div className="pt-8">
            <WebsiteButton href={siteConfig.cta.primary.href} size="lg">
              Get a Free Demo
            </WebsiteButton>
          </div>
        </div>

        {/* Right: Lead form */}
        <div className="lg:sticky lg:top-24">
          <Suspense>
            <LeadForm redirectPath="/lp/grow-agent/thank-you" />
          </Suspense>
        </div>
      </div>
    </section>
  );
}
