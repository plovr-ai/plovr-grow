import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { GrowLandingHero } from "./components/GrowLandingHero";
import { AgentShowcase } from "./components/AgentShowcase";
import { GrowAgentPainPoints } from "@/components/website/sections/grow-agent/GrowAgentPainPoints";
import { GrowAgentBentoGrid } from "@/components/website/sections/grow-agent/GrowAgentBentoGrid";
import { FAQ } from "@/components/website/sections/FAQ";
import { Testimonials } from "@/components/website/sections/Testimonials";
import { CTACard } from "@/components/website/sections/CTACard";

export const metadata: Metadata = {
  title: "AI Growth Agent for Restaurants | Localgrow",
  description:
    "From SEO to Social Media, our specialized AI agents manage your entire online presence to drive consistent foot traffic and reclaim your margins.",
  openGraph: {
    title: "AI Growth Agent for Restaurants | Localgrow",
    description:
      "From SEO to Social Media, our specialized AI agents manage your entire online presence to drive consistent foot traffic and reclaim your margins.",
    url: `${siteConfig.url}/lp/grow-agent`,
    siteName: siteConfig.name,
    images: [{ url: siteConfig.ogImage }],
    locale: siteConfig.locale,
    type: "website",
  },
};

/* ── Pain Point Cards ── */

const painPointCards = [
  {
    icon: (
      <svg className="size-6" viewBox="0 0 23 19" fill="none" stroke="#FFBF00" strokeLinecap="round" strokeLinejoin="round">
        <path d="M0.5 16.5H5.5M5.5 10.5H0.5V18.5H5.5V10.5Z" />
        <path d="M2.5 8.498V5.5H10.5V16.5H7.5" />
        <path d="M4.5 3.499V0.5H22.5V14.5H12.5M10.5 14.5H7.5M22.5 11.5H12.5M13.5 14.5V18.5M9.5 18.5H17.5M17 2.999L20 6M19.5 2.499L20.5 3.499" />
      </svg>
    ),
    title: "The Platform Maze is Getting Harder.",
    description:
      "Managing Google, Yelp, Instagram, and DoorDash separately is a full-time job your team doesn't have time for.",
  },
  {
    icon: (
      <svg className="size-6" viewBox="0 0 22 22" fill="none" stroke="#FFBF00" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3.5 4L7 0.5M3.5 7L7 10.5H3.5V0.5H21.5V10.5H13.5M21.5 4L18 0.5M21.5 7L18 10.5M3 21.5L8.5 18.5H15.5L21 15.5L20.5 14L15.5 15L9 14.5L11 12L10.5 10.5L5.5 13.5L3 16.5L0.5 17.5" />
        <path d="M13.5 3.5H11.5L11 4.5L11.5 5.5H13.5L14 6.5L13.5 7.5H11.5M12.5 3.5V2.5M12.5 8.5V7.5" />
      </svg>
    ),
    title: "Stop Feeding the 30% Commissions.",
    description:
      "High-commission platforms dominate your visibility, eroding your margins on every single order you fulfill.",
  },
  {
    icon: (
      <svg className="size-6" viewBox="0 0 24 24" fill="#FFBF00">
        <path d="M5.33 3.272C5.997 3.034 6.72 3.004 7.405 3.186C8.089 3.368 8.702 3.753 9.163 4.291C9.624 4.828 9.911 5.493 9.986 6.197C10.061 6.901 9.921 7.611 9.584 8.234L20.293 18.944L18.879 20.358L8.169 9.648C7.546 9.984 6.836 10.123 6.132 10.048C5.429 9.972 4.764 9.685 4.227 9.224C3.69 8.763 3.305 8.151 3.123 7.467C2.941 6.783 2.97 6.06 3.207 5.393L5.444 7.63C5.727 7.903 6.106 8.054 6.499 8.051C6.892 8.048 7.269 7.89 7.547 7.612C7.825 7.334 7.983 6.957 7.986 6.564C7.989 6.171 7.838 5.792 7.565 5.509L5.33 3.272ZM15.697 5.155L18.879 3.387L20.293 4.802L18.525 7.984L16.757 8.337L14.637 10.458L13.222 9.044L15.343 6.923L15.697 5.155ZM8.979 13.287L10.394 14.701L5.09 20.004C4.91 20.185 4.667 20.29 4.412 20.297C4.157 20.305 3.908 20.215 3.717 20.045C3.527 19.875 3.408 19.639 3.386 19.385C3.363 19.13 3.439 18.877 3.598 18.677L3.676 18.59L8.979 13.287Z" />
      </svg>
    ),
    title: "Tools Alone Won't Bring Orders.",
    description:
      "Independent restaurants lack the massive teams and budgets needed to turn \"marketing tools\" into actual traffic and sales.",
  },
];

/* ── FAQ Items ── */

const faqItems = [
  {
    question: "Do I really just talk to the app? No complex dashboards?",
    answer:
      "Through our Natural Language Interface, you manage your marketing and operations just like you're texting a teammate. No menus to navigate, no learning curve\u2014just tell the AI what you need.",
  },
  {
    question: "How do I stay in control of what the AI is doing?",
    answer:
      "You have full visibility and approval authority over every action the AI takes. For routine tasks like responding to positive reviews, the AI handles them automatically. For anything significant\u2014new campaigns, budget changes, or negative review responses\u2014it flags you for approval before executing.",
  },
  {
    question:
      "Does the AI actually execute the tasks, or just give advice?",
    answer:
      "Our AI agents are execution-first. They don't just suggest\u2014they do the work. From posting on social media and responding to reviews to optimizing your Google Business Profile, the agents handle the heavy lifting end-to-end, with expert oversight ensuring quality.",
  },
];

/* ── Testimonials ── */

const testimonials = [
  {
    quote:
      "I get notified for every new review. The AI handles all the positive ones automatically, and for anything negative, it lets me decide whether to approve a response or step in myself. Our Google Search traffic has already jumped by 30%!",
    author: "Marcus T.",
  },
  {
    quote:
      "Now, whenever we have a new dish or a promotion, it's automatically posted to Instagram and synced to Google. Our follower count is growing, and it's seriously boosting our local search ranking.",
    author: "Sarah L.",
  },
  {
    quote:
      "My Agent flags regulars who haven't shown up in a month and hits me up to run promos before holidays. But it doesn't just suggest\u2014once I give the thumbs up, it handles all the heavy lifting.",
    author: "David K.",
  },
];

export default function GrowAgentLandingPage() {
  return (
    <>
      <GrowLandingHero />

      <AgentShowcase />

      <GrowAgentPainPoints cards={painPointCards} />

      <GrowAgentBentoGrid />

      <FAQ
        title="Frequently Asked Questions"
        items={faqItems}
        variant="card"
      />

      <Testimonials
        title="Trusted by General Managers"
        items={testimonials}
      />

      <CTACard
        variant="light"
        title="Your AI Growth Squad. Dominating All Online Channels."
        description="Join the managers who have reclaimed their time and increased their profits with localgrow.ai."
        decorative
        cta={{
          label: "Get a Free Demo",
          href: siteConfig.cta.primary.href,
        }}
      />
    </>
  );
}
