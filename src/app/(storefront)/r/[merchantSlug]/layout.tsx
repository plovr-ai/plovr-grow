import type { Metadata } from "next";
import { getMockWebsiteData } from "@/data/mock/website";
import { MerchantProvider, ThemeProvider } from "@/contexts";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ merchantSlug: string }>;
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { merchantSlug } = await params;
  const data = getMockWebsiteData(merchantSlug);

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

export default async function MerchantLayout({ children, params }: LayoutProps) {
  const { merchantSlug } = await params;
  const data = getMockWebsiteData(merchantSlug);

  return (
    <ThemeProvider preset={data.merchant.themePreset}>
      <MerchantProvider
        config={{
          currency: data.merchant.currency,
          locale: data.merchant.locale,
          tipConfig: data.merchant.tipConfig,
        }}
      >
        {children}
      </MerchantProvider>
    </ThemeProvider>
  );
}
