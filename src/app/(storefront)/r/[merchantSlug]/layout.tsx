import type { Metadata } from "next";
import { merchantService } from "@/services/merchant";
import { MerchantProvider, ThemeProvider, LoyaltyProvider } from "@/contexts";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ merchantSlug: string }>;
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { merchantSlug } = await params;
  const websiteData = await merchantService.getWebsiteData(merchantSlug);

  if (!websiteData) {
    return {
      title: "Order Online",
    };
  }

  return {
    title: `${websiteData.name} | Order Online`,
    description: websiteData.tagline,
    openGraph: {
      title: websiteData.name,
      description: websiteData.tagline,
      images: websiteData.heroImage ? [websiteData.heroImage] : [],
    },
  };
}

export default async function MerchantLayout({ children, params }: LayoutProps) {
  const { merchantSlug } = await params;
  const merchant = await merchantService.getMerchantBySlug(merchantSlug);

  // Get theme preset from company settings
  const themePreset = merchant?.company?.settings?.themePreset;

  return (
    <ThemeProvider preset={themePreset}>
      <MerchantProvider
        config={{
          name: merchant?.name ?? "",
          logoUrl: merchant?.logoUrl ?? null,
          currency: merchant?.currency ?? "USD",
          locale: merchant?.locale ?? "en-US",
          timezone: merchant?.timezone ?? "America/New_York",
          country: merchant?.country ?? "US",
          tipConfig: merchant?.settings?.tipConfig,
          feeConfig: merchant?.settings?.feeConfig,
          companySlug: merchant?.company?.slug ?? null,
          companyId: merchant?.company?.id ?? null,
        }}
      >
        <LoyaltyProvider>{children}</LoyaltyProvider>
      </MerchantProvider>
    </ThemeProvider>
  );
}
