import type { Metadata } from "next";
import { getMockWebsiteData } from "@/data/mock/website";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { slug } = await params;
  const data = getMockWebsiteData(slug);

  return {
    title: `${data.merchant.name} | Order Online`,
    description: data.merchant.tagline,
    openGraph: {
      title: data.merchant.name,
      description: data.merchant.tagline,
      images: [data.merchant.heroImage],
    },
  };
}

export default function RestaurantLayout({ children }: LayoutProps) {
  return <>{children}</>;
}
