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

const heroFeatures = [
  {
    icon: "mic",
    label: "Humanlike voice",
    caption: "Natural conversational AI customers love.",
  },
  {
    icon: "clock",
    label: "24/7 Availability",
    caption: "Always on, never sleeps or takes breaks.",
  },
  {
    icon: "phone-forwarded",
    label: "Multi-line VoIP",
    caption: "No busy signals. Unlimited concurrency.",
  },
  {
    icon: "zap",
    label: "Instant Setup",
    caption: "Get started in minutes, not hours.",
  },
];

const voiceBullets = [
  { label: "99.9%+ success rates" },
  { label: "Industrial-grade stability" },
  { label: "Ultra-low latency" },
];

const autoPilotCards = [
  {
    title: "Local SEO Agent",
    description:
      '"Your GBP Profile has been completed. Google Search traffic grew by 50% over the last 30 days."',
    richContent: "seo" as const,
  },
  {
    title: "Review Agent",
    description:
      '"New negative review detected. I have drafted a reply for you. If you think it\'s fine, just click send and it will be synced to Google."',
    richContent: "review" as const,
  },
  {
    title: "Instagram Agent",
    description:
      '"Today\'s new dish have been posted. You can check it out."',
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
    quote:
      "The AI voice agent handles our peak lunch rush perfectly. We've seen a 22% increase in ticket volume simply because we never miss a call anymore.",
    author: "Marcus",
  },
  {
    quote:
      "Game changer for our small team. The manager agent helps us make data-driven decisions without needing a full analytics department.",
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
        primaryCta={{
          label: "Start a 7-Day Free Trial",
          href: siteConfig.cta.primary.href,
          external: true,
        }}
      />

      <ValueProp
        title="Your Agentic"
        titleAccent="Restaurant Partner"
        description="The intelligent partner for modern restaurateurs and local entrepreneurs. While you focus on the craft of service and your guests, our AI agents handle the digital heavy lifting."
        cta={{
          label: "Get a Free Demo",
          href: siteConfig.cta.secondary.href,
          external: true,
        }}
      />

      <VoiceAgent
        eyebrow="Human-Parity"
        title="An AI Voice Agent"
        titleAccent="Speak like your best host"
        description="Capture every reservation, answer every inquiry, and never let a busy hour cost you a guest."
        bullets={voiceBullets}
        agentName="Ava"
        primaryCta={{
          label: "Call Agent",
          href: siteConfig.cta.secondary.href,
          external: true,
        }}
        secondaryCta={{
          label: "Get a Call",
          href: siteConfig.cta.secondary.href,
          external: true,
        }}
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
        cta={{
          label: "Try it Free Demo",
          href: siteConfig.cta.secondary.href,
          external: true,
        }}
      />
    </>
  );
}
