import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { HomeHero } from "@/components/website/sections/HomeHero";
import { CostOfSilence } from "@/components/website/sections/CostOfSilence";
import { AvaAdvantage } from "@/components/website/sections/AvaAdvantage";
import { Testimonials } from "@/components/website/sections/Testimonials";
import { FAQ } from "@/components/website/sections/FAQ";
import { CTACard } from "@/components/website/sections/CTACard";

export const metadata: Metadata = {
  title: `${siteConfig.name} - ${siteConfig.tagline}`,
  description: siteConfig.description,
  openGraph: {
    title: `${siteConfig.name} - ${siteConfig.tagline}`,
    description: siteConfig.description,
    url: siteConfig.url,
    siteName: siteConfig.name,
    images: [{ url: siteConfig.ogImage }],
    locale: siteConfig.locale,
    type: "website",
  },
};

/* ── Cost of Silence cards ── */

const costCards = [
  {
    iconSvg: (
      <svg className="size-6" viewBox="0 0 25 15" fill="#BA1A1A" aria-hidden="true">
        <path d="M24.5 1.5l-5.3 5.3-4-4L10 8l-1.4-1.4 6.6-6.6 4 4L23.1 0 24.5 1.5zM.5 13.5h2v1h-2v-1zm4-3h2v4h-2v-4zm4-2h2v6h-2v-6zm4-3h2v9h-2v-9zm4-2h2v11h-2v-11zm4-2h2v13h-2V1.5z" />
      </svg>
    ),
    iconBg: "bg-[rgba(186,26,26,0.1)]",
    stat: "3 missed calls=$100",
    statColor: "text-[#ba1a1a]",
    description:
      "Most restaurants miss 30% of calls during peak hours.",
  },
  {
    iconSvg: (
      <svg className="size-6" viewBox="0 0 27.5 20" fill="#795900" aria-hidden="true">
        <path d="M25 7.5h-5V5a5 5 0 00-10 0v2.5H5A2.5 2.5 0 002.5 10v7.5A2.5 2.5 0 005 20h20a2.5 2.5 0 002.5-2.5V10A2.5 2.5 0 0025 7.5zM15 15.63a1.88 1.88 0 110-3.76 1.88 1.88 0 010 3.76zM18.75 7.5h-7.5V5a3.75 3.75 0 017.5 0v2.5z" />
      </svg>
    ),
    iconBg: "bg-[rgba(255,191,0,0.1)]",
    stat: "Overpaying $15-$25/hr",
    statColor: "text-[#795900]",
    description:
      "Overpaying for human receptionists when call volume is unpredictable.",
  },
  {
    iconSvg: (
      <svg className="size-6" viewBox="0 0 25 23.66" fill="#755A1F" aria-hidden="true">
        <path d="M12.5 0l3.09 6.26L22.5 7.27l-5 4.87 1.18 6.88-6.18-3.25-6.18 3.25L7.5 12.14l-5-4.87 6.91-1.01L12.5 0z" />
      </svg>
    ),
    iconBg: "bg-[rgba(253,216,143,0.2)]",
    stat: "Inconsistent Service Quality",
    statColor: "text-ws-text-heading",
    description:
      "Eliminate Human Inconsistency drive customers to leave bad reviews.",
  },
];

/* ── Ava Advantage cards ── */

const advantageCards = [
  {
    iconSvg: (
      <svg className="size-9" viewBox="0 0 36 24" fill="#FFBF00" aria-hidden="true">
        <path d="M18 0C9 0 1.3 5.5 0 12c1.3 6.5 9 12 18 12s16.7-5.5 18-12C34.7 5.5 27 0 18 0zm0 20a8 8 0 110-16 8 8 0 010 16zm0-12.8a4.8 4.8 0 100 9.6 4.8 4.8 0 000-9.6z" />
      </svg>
    ),
    title: "High Concurrency",
    description: "No busy tones. Handle unlimited calls during peak hours.",
  },
  {
    iconSvg: (
      <svg className="size-8" viewBox="0 0 30.75 29.25" fill="#FFBF00" aria-hidden="true">
        <path d="M15.38 0a14.63 14.63 0 100 29.25 14.63 14.63 0 000-29.25zm0 26.33A11.7 11.7 0 1127.08 14.63 11.71 11.71 0 0115.38 26.33z" />
        <path d="M22.52 17.4a1.46 1.46 0 00-2-.54l-3.68 2.12V7.31a1.46 1.46 0 10-2.93 0v11.67L10.23 16.86a1.46 1.46 0 10-1.46 2.54l5.14 2.97a1.46 1.46 0 001.46 0l5.14-2.97a1.46 1.46 0 00.01-2z" />
      </svg>
    ),
    title: "Human-Like",
    description: "Ultra-low latency. Professional, natural, and friendly.",
  },
  {
    iconSvg: (
      <svg className="size-8" viewBox="0 0 30 30" fill="#FFBF00" aria-hidden="true">
        <path d="M15 0C6.72 0 0 6.72 0 15s6.72 15 15 15 15-6.72 15-15S23.28 0 15 0zm0 27a12 12 0 110-24 12 12 0 010 24z" />
        <path d="M15 6a1.5 1.5 0 00-1.5 1.5v7.5a1.5 1.5 0 00.75 1.3l5.25 3a1.5 1.5 0 101.5-2.6l-4.5-2.6V7.5A1.5 1.5 0 0015 6z" />
      </svg>
    ),
    title: "Pay-as-you-go",
    description: "High ROI. No salaries, just smart, usage-based pricing.",
  },
  {
    iconSvg: (
      <svg className="size-8" viewBox="0 0 33 24" fill="#FFBF00" aria-hidden="true">
        <path d="M30 0H3a3 3 0 00-3 3v18a3 3 0 003 3h27a3 3 0 003-3V3a3 3 0 00-3-3zm-1.5 19.5h-24v-15h24v15z" />
        <path d="M7.5 9h6v1.5h-6V9zm0 3h9v1.5h-9V12zm0 3h4.5v1.5H7.5V15z" />
      </svg>
    ),
    title: "Deep Menu Knowledge",
    description: "Zero errors. Handles complex orders and dietary needs.",
  },
  {
    iconSvg: (
      <svg className="size-8" viewBox="0 0 33 31.5" fill="#FFBF00" aria-hidden="true">
        <path d="M16.5 0A16.5 16.5 0 000 16.5c0 5.2 2.4 9.8 6.2 12.8l1.9-2.5A13.2 13.2 0 013.3 16.5 13.2 13.2 0 0116.5 3.3a13.2 13.2 0 0113.2 13.2c0 3.9-1.7 7.4-4.4 9.8l1.9 2.5a16.4 16.4 0 006.3-12.3A16.5 16.5 0 0016.5 0z" />
        <path d="M16.5 8.25a8.25 8.25 0 100 16.5 8.25 8.25 0 000-16.5zm0 13.2a4.95 4.95 0 110-9.9 4.95 4.95 0 010 9.9z" />
      </svg>
    ),
    title: "99.9% Success Rate",
    description: "99.9% stability. Capture every order, 24/7.",
  },
  {
    iconSvg: (
      <svg className="size-8" viewBox="0 0 33 33" fill="#FFBF00" aria-hidden="true">
        <path d="M29.7 3.3H3.3A3.3 3.3 0 000 6.6v19.8a3.3 3.3 0 003.3 3.3h26.4a3.3 3.3 0 003.3-3.3V6.6a3.3 3.3 0 00-3.3-3.3zm0 23.1H3.3V6.6h26.4v19.8z" />
        <path d="M14.85 11.55l-3.3 3.3-1.65-1.65-2.34 2.34L11.55 19.53l5.64-5.64-2.34-2.34z" />
        <path d="M19.8 13.2h6.6v2.31h-6.6V13.2zm0 4.95h6.6v2.31h-6.6v-2.31z" />
      </svg>
    ),
    title: "Seamless Integration",
    description: "Direct sync with Toast, Clover, and Square.",
  },
];

/* ── Testimonials ── */

const testimonials = [
  {
    quote:
      "If the agent hadn't mentioned it, I honestly wouldn't have known I was ordering from an AI. Best of all, it even recommended a combo deal that saved me money.",
    author: "Ben T.",
  },
  {
    quote:
      "I didn't realize how many calls we were missing during the lunch and dinner rush until we started using this. Now that we're capturing every single order, our sales have seen a significant jump.",
    author: "Allan R.",
  },
  {
    quote:
      "I used to dread hearing the phone ring while I was slammed with in-store customers. With AVA, I can finally stay focused on the guests right in front of me without the constant distraction.",
    author: "Murphy S.",
  },
];

/* ── FAQ items ── */

const faqItems = [
  {
    question: "What happens if agent can't answer a guest?",
    answer:
      "If Ava encounters a question she can't answer, she'll politely let the caller know and seamlessly transfer the call to a staff member. You'll also get a notification so you can follow up.",
  },
  {
    question: "How does it integrate with my POS?",
    answer:
      "Ava integrates directly with major POS systems including Toast, Clover, and Square. Orders placed through Ava are automatically synced to your POS in real-time, so your kitchen workflow stays uninterrupted.",
  },
  {
    question: "What is the typical setup time?",
    answer:
      "Most restaurants are fully set up and taking AI-powered calls within 24 hours. Our team handles the technical integration so you can focus on running your business.",
  },
  {
    question: "What can Agent handle on a call?",
    answer:
      "Ava can take phone orders, answer menu questions, handle dietary restriction inquiries, provide store hours and location info, process reservations, and route complex requests to your staff.",
  },
];

export default function HomePage() {
  return (
    <>
      <HomeHero
        badge="0 Busy signals"
        title="Stop Losing Revenue To"
        titleHighlight="Misses Calls"
        subtitle="Our AI Voice Agent that handles 100% of your phone orders with human-like precision, 24/7."
        agentName="Ava"
        agentSubtitle="Hearing is believing"
        callCta={{
          label: "Call Me",
          href: siteConfig.cta.secondary.href,
          external: true,
        }}
        talkCta={{
          label: "Talk Now",
          href: siteConfig.cta.secondary.href,
          external: true,
        }}
        demoCta={{
          label: "Get a Free Demo",
          href: siteConfig.cta.secondary.href,
          external: true,
        }}
      />

      <CostOfSilence
        title="The Cost of Silence"
        subtitle="Every missed call is a customer lost to your competitor."
        cards={costCards}
      />

      <AvaAdvantage
        eyebrow={'Meet "Ava", our AI agent.'}
        title="Industrial-Grade Reliability Meet Human-Like Warmth."
        cards={advantageCards}
      />

      <Testimonials items={testimonials} />

      <FAQ
        title="Common Questions"
        items={faqItems}
        variant="card"
      />

      <CTACard
        variant="light"
        title="Unlock your AI partner for hospitality now!"
        description="Join the hundreds of managers who have reclaimed their time and increased their profits with localgrow.ai."
        decorative
        cta={{
          label: "Get a Free Demo",
          href: siteConfig.cta.secondary.href,
          external: true,
        }}
      />
    </>
  );
}
