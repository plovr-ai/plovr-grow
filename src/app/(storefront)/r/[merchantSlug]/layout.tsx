import type { Metadata } from "next";
import { getMockWebsiteData } from "@/data/mock/website";
import { merchantService } from "@/services/merchant";
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
  const merchant = await merchantService.getMerchantBySlug(merchantSlug);

  // Get theme preset from company settings
  const themePreset = merchant?.company?.settings?.themePreset;

  return (
    <ThemeProvider preset={themePreset}>
      <MerchantProvider
        config={{
          currency: merchant?.currency ?? data.merchant.currency,
          locale: merchant?.locale ?? data.merchant.locale,
          tipConfig: merchant?.settings?.tipConfig,
          feeConfig: merchant?.settings?.feeConfig,
        }}
      >
        {children}
      </MerchantProvider>
    </ThemeProvider>
  );
}
