import type { Metadata } from "next";
import { merchantService } from "@/services/merchant";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ merchantSlug: string }>;
}

export async function generateMetadata({
  params,
}: LayoutProps): Promise<Metadata> {
  const { merchantSlug } = await params;
  const websiteData = await merchantService.getWebsiteData(merchantSlug);

  if (!websiteData) {
    return {
      title: "Menu",
    };
  }

  return {
    title: `Menu | ${websiteData.name}`,
    description: `Order online from ${websiteData.name}`,
  };
}

export default function MenuLayout({ children }: LayoutProps) {
  return <div className="min-h-screen bg-gray-50">{children}</div>;
}
