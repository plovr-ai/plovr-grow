import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { menuService } from "@/services/menu";
import { MenuPanel, PhoneSimulator, PlaygroundLayout } from "./components";

export const metadata: Metadata = {
  title: `AI Voice Ordering Playground | ${siteConfig.name}`,
  description:
    "Try our AI voice agent — browse the menu and order by voice in real time.",
  openGraph: {
    title: `AI Voice Ordering Playground | ${siteConfig.name}`,
    description:
      "Try our AI voice agent — browse the menu and order by voice in real time.",
    url: `${siteConfig.url}/playground`,
    siteName: siteConfig.name,
    images: [{ url: siteConfig.ogImage }],
    locale: siteConfig.locale,
    type: "website",
  },
};

export default async function PlaygroundPage() {
  const tenantId = process.env.NEXT_PUBLIC_PLAYGROUND_TENANT_ID ?? "";
  const merchantId = process.env.NEXT_PUBLIC_PLAYGROUND_MERCHANT_ID ?? "";

  let categories: Awaited<ReturnType<typeof menuService.getMenu>>["categories"] = [];
  const currency = "USD";

  if (tenantId && merchantId) {
    try {
      const response = await menuService.getMenu(tenantId, merchantId);
      categories = response.categories;
    } catch {
      // Menu fetch failed — show empty menu panel
    }
  }

  return (
    <PlaygroundLayout
      menuPanel={<MenuPanel categories={categories} currency={currency} />}
      phoneSimulator={<PhoneSimulator />}
    />
  );
}
