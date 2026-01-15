import type { Metadata } from "next";
import { getMockWebsiteData } from "@/data/mock/website";
import { MerchantProvider } from "@/contexts";

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

export default async function RestaurantLayout({ children, params }: LayoutProps) {
  const { slug } = await params;
  const data = getMockWebsiteData(slug);

  return (
    <MerchantProvider
      config={{
        currency: data.merchant.currency,
        locale: data.merchant.locale,
      }}
    >
      {children}
    </MerchantProvider>
  );
}
