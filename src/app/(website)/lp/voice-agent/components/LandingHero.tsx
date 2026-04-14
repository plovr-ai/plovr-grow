import { Suspense } from "react";
import { CallDemoCard } from "@/components/website/sections/CallDemoCard";
import { LeadForm } from "./LeadForm";

export function LandingHero() {
  return (
    <section className="relative bg-ws-bg-page px-6 md:px-8">
      <div className="mx-auto grid max-w-6xl gap-12 pt-16 pb-12 lg:grid-cols-[1fr_420px] lg:items-start lg:gap-16">
        {/* Left: Hero content */}
        <div className="flex flex-col">
          {/* Title */}
          <h1 className="max-w-xl text-5xl font-extrabold leading-tight tracking-tight md:text-6xl lg:text-7xl">
            <span className="text-ws-text-heading">
              Stop Losing Revenue to{" "}
            </span>
            <span className="relative inline text-[#ffbf00]">
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-2 bg-[rgba(255,191,0,0.2)] md:bottom-1 md:h-3"
              />
              <span className="relative">Missed Calls</span>
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 max-w-lg text-lg font-light leading-8 text-ws-text-body md:text-xl">
            Our AI Voice Agent that handles 100% of your phone orders with
            human-like precision, 24/7.
          </p>

          {/* Conversation demo card (compact) */}
          <div className="mt-10">
            <CallDemoCard compact />
          </div>
        </div>

        {/* Right: Lead form */}
        <div className="lg:sticky lg:top-24">
          <Suspense>
            <LeadForm />
          </Suspense>
        </div>
      </div>
    </section>
  );
}
