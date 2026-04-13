import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { getAllReleases } from "@/lib/content";
import { Hero } from "@/components/website/sections/Hero";
import { ReleaseTimeline } from "@/components/website/sections/ReleaseTimeline";
import { CTACard } from "@/components/website/sections/CTACard";

export const metadata: Metadata = {
  title: `Releases — ${siteConfig.name}`,
  description:
    "The latest product updates, improvements, and fixes from the Localgrow team.",
};

export default function ReleasesPage() {
  const releases = getAllReleases();

  return (
    <>
      <Hero
        eyebrow="Changelog"
        title="What's new in"
        titleAccent="Localgrow."
        description="Product updates, improvements, and fixes from the team."
      />
      <ReleaseTimeline releases={releases} />
      <CTACard />
    </>
  );
}
