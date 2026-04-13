import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { Hero } from "@/components/website/sections/Hero";
import { PricingTable } from "@/components/website/sections/PricingTable";
import { FAQ } from "@/components/website/sections/FAQ";
import { CTACard } from "@/components/website/sections/CTACard";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple plans that pay for themselves the first week you are live.",
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
    cta: {
      label: "Start a Free Trial",
      href: siteConfig.cta.primary.href,
      external: true,
    },
    ctaVariant: "secondary" as const,
  },
  {
    name: "Pro",
    price: "$249",
    period: "/ month",
    description:
      "Everything a single location needs to stop losing calls.",
    features: [
      "Up to 1,500 calls per month",
      "Reservations and takeout",
      "Email and SMS confirmations",
      "Analytics dashboard",
      "Business-hours support",
    ],
    cta: {
      label: "Get Pro Now",
      href: siteConfig.cta.primary.href,
      external: true,
    },
    ctaVariant: "primary" as const,
    highlighted: true,
  },
  {
    name: "Growth",
    price: "$449",
    period: "/ month",
    description:
      "Multi-location hospitality brands with serious call volume.",
    features: [
      "Everything in Pro",
      "Unlimited calls",
      "Multi-location routing",
      "POS integration",
      "Priority human handoff",
      "Dedicated success manager",
    ],
    cta: {
      label: "Talk to Sales",
      href: siteConfig.cta.secondary.href,
      external: true,
    },
    ctaVariant: "dark" as const,
  },
];

const faqs = [
  {
    question: "What is Ordering Agent?",
    answer:
      "The Ordering Agent is plugged in to your phone lines to convert inbound orders automatically, talking with guests in natural language.",
  },
  {
    question: "Does the Ordering Agent support multiple languages?",
    answer:
      "Yes. English and Spanish are included on all plans. Additional languages are available on request for Pro and Growth customers.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Yes — monthly billing, cancel with a single click from your dashboard.",
  },
  {
    question: "Does cancellation work with my POS?",
    answer:
      "We integrate with the major hospitality POS systems via a pre-built connector. Custom integrations take about a week.",
  },
  {
    question: "Is there a setup fee?",
    answer: "No. Setup is included with every plan.",
  },
  {
    question: "What kind of support is provided?",
    answer:
      "All plans get community + email support. Pro plans add business-hours support. Growth plans get a dedicated success manager.",
  },
];

export default function PricingPage() {
  return (
    <>
      <Hero title="Prices" description="" variant="warm" />

      <PricingTable
        plans={plans}
        tabs={["Free Plan", "Growth Plan", "Manage Agent"]}
        activeTab="Free Plan"
      />

      <FAQ
        title="Frequently Asked"
        titleBreak="Questions"
        description="Everything you need to know about Localgrow pricing and plans."
        items={faqs}
        variant="default"
        layout="split"
      />

      <CTACard
        variant="dark"
        title="Unlock your AI partner for hospitality now!"
      />
    </>
  );
}
