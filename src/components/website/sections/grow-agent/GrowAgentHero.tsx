import Image from "next/image";
import { Container } from "@/components/website/ui/Container";
import { WebsiteButton } from "@/components/website/ui/WebsiteButton";
import { siteConfig } from "@/config/site";

function SeoAgentCard() {
  return (
    <div className="w-[380px] rounded-[32px] border border-[rgba(212,197,171,0.1)] bg-white/80 px-6 py-6 shadow-[0px_20px_40px_0px_rgba(25,28,29,0.04)] backdrop-blur-xl">
      <div className="flex items-start gap-4">
        {/* Progress circle */}
        <div className="relative flex size-14 shrink-0 items-center justify-center">
          <svg className="size-14 -rotate-90" viewBox="0 0 56 56" fill="none">
            <circle cx="28" cy="28" r="24" stroke="#EDEEEF" strokeWidth="4" />
            <circle
              cx="28"
              cy="28"
              r="24"
              stroke="#FFBF00"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 24 * 0.92} ${2 * Math.PI * 24}`}
            />
          </svg>
          <span className="absolute text-xs font-bold text-ws-text-heading">92</span>
        </div>

        {/* Info */}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-base font-bold text-ws-text-heading">SEO Agent</span>
            <span className="rounded-full bg-[rgba(255,191,0,0.2)] px-2 py-0.5 text-[10px] font-bold text-[#795900]">
              Ranked #1
            </span>
          </div>
          <p className="text-xs text-ws-text-body">
            &quot;Best Brunch near me&quot; &bull;{" "}
            <span className="font-bold text-[#ffbf00]">95% Complete</span>
          </p>
          <div className="flex items-center gap-1">
            <svg className="size-2.5" viewBox="0 0 10 6" fill="#16A34A">
              <path d="M0.7 6L0 5.3L3.7 1.575L5.7 3.575L8.3 1H7V0H10V3H9V1.7L5.7 5L3.7 3L0.7 6Z" />
            </svg>
            <span className="text-[10px] font-medium text-ws-text-body">
              Google GBP Profile optimization complete
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SocialAgentCard() {
  return (
    <div className="w-[380px] rounded-[32px] border border-[rgba(212,197,171,0.1)] bg-white/80 p-6 shadow-[0px_20px_40px_0px_rgba(25,28,29,0.04)] backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <div className="flex size-10 items-center justify-center rounded-full bg-[rgba(255,191,0,0.2)]">
          <svg className="size-5" viewBox="0 0 20 18" fill="#795900">
            <path d="M10 14.5C11.25 14.5 12.3125 14.0625 13.1875 13.1875C14.0625 12.3125 14.5 11.25 14.5 10C14.5 8.75 14.0625 7.6875 13.1875 6.8125C12.3125 5.9375 11.25 5.5 10 5.5C8.75 5.5 7.6875 5.9375 6.8125 6.8125C5.9375 7.6875 5.5 8.75 5.5 10C5.5 11.25 5.9375 12.3125 6.8125 13.1875C7.6875 14.0625 8.75 14.5 10 14.5ZM2 18C1.45 18 0.979 17.804 0.588 17.413C0.196 17.021 0 16.55 0 16V4C0 3.45 0.196 2.979 0.588 2.588C0.979 2.196 1.45 2 2 2H5.15L7 0H13L14.85 2H18C18.55 2 19.021 2.196 19.413 2.588C19.804 2.979 20 3.45 20 4V16C20 16.55 19.804 17.021 19.413 17.413C19.021 17.804 18.55 18 18 18H2Z" />
          </svg>
        </div>
        <div>
          <span className="text-base font-bold text-ws-text-heading">Social Agent</span>
          <p className="text-xs text-ws-text-body">Viral Content Creation</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="relative aspect-square overflow-hidden rounded-sm">
          <Image
            src="/images/grow-agent/social-bg-1.png"
            alt="Social media content"
            fill
            className="object-cover"
          />
        </div>
        <div className="relative aspect-square overflow-hidden rounded-sm">
          <Image
            src="/images/grow-agent/social-bg-2.png"
            alt="Social media content"
            fill
            className="object-cover"
          />
        </div>
        <div className="relative aspect-square overflow-hidden rounded-sm">
          <Image
            src="/images/grow-agent/social-overlay.png"
            alt="Social media content"
            fill
            className="object-cover"
          />
        </div>
      </div>
    </div>
  );
}

export function GrowAgentHero() {
  return (
    <section className="overflow-clip bg-[#f8f9fa] pb-32 pt-24">
      <Container>
        <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-12">
          {/* Left: text content */}
          <div className="flex flex-col items-start gap-6 lg:col-span-7">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full bg-[rgba(253,216,143,0.3)] px-3 py-1">
              <div className="size-2 rounded-full bg-[#ffbf00]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#775d21]">
                All Online Channels
              </span>
            </div>

            {/* Title */}
            <h1 className="font-display text-5xl font-extrabold leading-tight tracking-tight md:text-7xl lg:text-[80px] lg:leading-[88px] lg:tracking-[-4px]">
              <span className="text-[#131313]">Your </span>
              <span className="text-[#ffbf01]">AI Growth</span>
              <span className="text-[#131313]"> Squad. Expertly </span>
              <span className="text-[#ffbf01]">Supervised</span>
            </h1>

            {/* Description */}
            <p className="max-w-xl text-lg leading-relaxed text-ws-text-body md:text-xl">
              From SEO to Social Media, our specialized agents manage your entire
              online presence to drive consistent foot traffic and reclaim your
              margins from high-fee platforms.
            </p>

            {/* CTA */}
            <div className="pt-4">
              <WebsiteButton href={siteConfig.cta.primary.href} size="lg">
                Get a Free Demo
              </WebsiteButton>
            </div>
          </div>

          {/* Right: floating cards */}
          <div className="relative hidden lg:col-span-5 lg:block">
            {/* Decorative glow */}
            <div
              aria-hidden="true"
              className="absolute -right-20 -top-20 size-96 rounded-full bg-[rgba(255,191,0,0.1)] blur-[60px]"
            />

            <div className="relative">
              <div className="rotate-1">
                <SeoAgentCard />
              </div>
              <div className="mt-4 rotate-1">
                <SocialAgentCard />
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
