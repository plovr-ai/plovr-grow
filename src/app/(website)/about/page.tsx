import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { Hero } from "@/components/website/sections/Hero";
import { MissionBlock } from "@/components/website/sections/MissionBlock";
import { ValuesGrid } from "@/components/website/sections/ValuesGrid";
import { ImageBlock } from "@/components/website/sections/ImageBlock";
import { Timeline } from "@/components/website/sections/Timeline";
import { CTACard } from "@/components/website/sections/CTACard";

export const metadata: Metadata = {
  title: "About",
  description:
    "Cultivating the future of local business with agentic voice AI.",
};

const values = [
  {
    label: "Industrial Grade Reliability",
    description:
      "Five-nines uptime, disaster recovery, and enterprise-ready compliance baked into every layer of the platform.",
  },
  {
    label: "Human-Centric Design",
    description:
      "Every interaction is crafted to feel warm, helpful, and respectful of both guests and staff alike.",
  },
  {
    label: "Autonomous Execution",
    description:
      "Your AI agents ship the outcome, not the task list. Fewer dashboards, more results you can measure.",
  },
];

const journey = [
  {
    year: "2021 \u00b7 Founded",
    title: "Born in a kitchen",
    description:
      "Our founders started Localgrow after watching their favorite neighborhood bistro close from too many missed calls.",
  },
  {
    year: "2023 \u00b7 Pilot",
    title: "First 100 restaurants",
    description:
      "Recovered over $2M in missed revenue across our launch cohort, validating the agentic voice thesis for hospitality.",
  },
  {
    year: "2024 \u00b7 Today",
    title: "Scaling the floor",
    description:
      "Shipping Spanish, multi-location routing, and an autonomous marketing stack for the modern restaurateur.",
  },
];

export default function AboutPage() {
  return (
    <>
      <Hero
        eyebrow="Localgrow Ltd."
        title="Cultivating the Future of"
        titleAccent="Local Business."
        description="We empower the heartbeat of our communities with autonomous intelligence, ensuring the world&#x2019;s most personal businesses stay ahead of the curve."
      />

      <MissionBlock
        title="Bridging the gap between cold tech and human warmth."
        description="For years, technology that tried to serve local business was built for corporate scale. Localgrow is different — our agents are designed for the texture of hospitality, so the guest experience always feels personal."
      />

      <ValuesGrid values={values} />

      <ImageBlock
        alt="A warm restaurant interior at golden hour"
        ratio="ultra-wide"
      />

      <Timeline
        title="The Journey"
        entries={journey}
        layout="split"
        variant="subtle"
      />

      <CTACard
        variant="light"
        title="Ready to evolve?"
        description="Join the restaurants building the next era of hospitality with Localgrow."
        cta={{
          label: "Book a Free Demo",
          href: siteConfig.cta.secondary.href,
          external: true,
        }}
      />
    </>
  );
}
