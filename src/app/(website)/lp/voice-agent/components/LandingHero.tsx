import { Suspense } from "react";
import { siteConfig } from "@/config/site";
import { LeadForm } from "./LeadForm";

export function LandingHero() {
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
              Zero Busy Signals
            </span>
          </div>

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

          {/* Speak with Ava module (compact) */}
          <div className="relative mt-10 max-w-md rounded-3xl bg-white/70 p-6 shadow-[0px_10px_40px_0px_rgba(255,191,0,0.12)] backdrop-blur-sm">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-3xl border border-[rgba(225,212,191,0.3)]"
            />
            <div className="relative flex flex-col gap-6">
              {/* Agent identity */}
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <div className="absolute inset-0 rounded-full bg-[rgba(255,191,0,0.3)]" />
                  <div className="relative flex size-12 items-center justify-center rounded-full border border-[rgba(255,191,0,0.2)] bg-white shadow-xl">
                    <svg
                      className="size-5 text-[#ffbf00]"
                      viewBox="0 0 27 30"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M26.28 21.09l-5.72-2.86a1.71 1.71 0 00-2 .5l-2.53 3.09a13.24 13.24 0 01-6.33-6.33l3.09-2.53a1.7 1.7 0 00.5-2L10.43.24A1.72 1.72 0 008.47.05L1.33 1.48A1.71 1.71 0 000 3.14 25.72 25.72 0 0025.71 28.86a1.71 1.71 0 001.67-1.33l1.43-7.14a1.73 1.73 0 00-.53-1.9z" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-extrabold tracking-tight text-ws-text-heading">
                    Speak with Ava
                  </h3>
                  <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-ws-text-body opacity-70">
                    <span className="size-1.5 rounded-full bg-green-500" />
                    Hearing is believing
                  </p>
                </div>
                {/* LIVE badge */}
                <span className="ml-auto rounded-full bg-[#ffbf00] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                  Live
                </span>
              </div>

              {/* Waveform placeholder */}
              <div className="flex items-center justify-center rounded-2xl bg-gray-50 px-4 py-6">
                <svg
                  className="h-8 w-24 text-[#ffbf00]"
                  viewBox="0 0 100 32"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <rect x="0" y="10" width="4" height="12" rx="2" />
                  <rect x="8" y="4" width="4" height="24" rx="2" />
                  <rect x="16" y="8" width="4" height="16" rx="2" />
                  <rect x="24" y="2" width="4" height="28" rx="2" />
                  <rect x="32" y="10" width="4" height="12" rx="2" />
                  <rect x="40" y="6" width="4" height="20" rx="2" />
                  <rect x="48" y="12" width="4" height="8" rx="2" />
                  <rect x="56" y="4" width="4" height="24" rx="2" />
                  <rect x="64" y="8" width="4" height="16" rx="2" />
                  <rect x="72" y="2" width="4" height="28" rx="2" />
                  <rect x="80" y="10" width="4" height="12" rx="2" />
                  <rect x="88" y="6" width="4" height="20" rx="2" />
                </svg>
              </div>

              {/* Quote */}
              <p className="text-sm text-gray-500 italic">
                &ldquo;How can I help you with your order today?&rdquo;
              </p>

              {/* Call Agent button */}
              <a
                href={siteConfig.cta.secondary.href}
                className="inline-flex w-fit items-center gap-2 rounded-xl bg-white px-6 py-3 font-bold text-ws-text-heading shadow-sm transition-colors hover:bg-gray-50"
                style={{
                  border: "1px solid rgba(225,212,191,0.5)",
                }}
              >
                <svg
                  className="size-4 text-[#ffbf00]"
                  viewBox="0 0 18.4 18.4"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M17.45 13.52L13.1 11.34a1.16 1.16 0 00-1.34.34L10.08 13.74a8.87 8.87 0 01-4.23-4.23l2.06-1.69a1.14 1.14 0 00.34-1.34L6.07.13A1.15 1.15 0 004.73.01L.9.99A1.15 1.15 0 000 2.13 16.27 16.27 0 0016.27 18.4a1.15 1.15 0 001.14-.9l.98-3.83a1.16 1.16 0 00-.94-1.15z" />
                </svg>
                Call Agent
              </a>
            </div>
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
