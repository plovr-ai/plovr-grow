import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { getAllPosts } from "@/lib/content";
import { Hero } from "@/components/website/sections/Hero";
import { BlogGrid } from "@/components/website/sections/BlogGrid";
import { CTACard } from "@/components/website/sections/CTACard";

export const metadata: Metadata = {
  title: `Blog — ${siteConfig.name}`,
  description:
    "Perspectives, product updates, and playbooks from the Localgrow team.",
};

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <>
      <Hero
        eyebrow="Insights"
        title="Field notes from the"
        titleAccent="hospitality frontier."
        description="How restaurants are rebuilding operations for the agentic era."
      />
      <BlogGrid posts={posts} />
      <CTACard />
    </>
  );
}
