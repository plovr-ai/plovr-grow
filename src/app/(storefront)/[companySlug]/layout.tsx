import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { merchantService } from "@/services/merchant";
import { MerchantProvider, ThemeProvider, LoyaltyProvider } from "@/contexts";
import { ClaimBar } from "@storefront/components/trial/ClaimBar";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ companySlug: string }>;
}

export async function generateMetadata({
  params,
}: LayoutProps): Promise<Metadata> {
  const { companySlug } = await params;
  const company = await merchantService.getCompanyBySlug(companySlug);

  if (!company) {
    return {
      title: "Not Found",
    };
  }

  return {
    title: `${company.name} | Order Online`,
    description: company.description,
    openGraph: {
      title: company.name,
      description: company.description ?? undefined,
    },
  };
}

export default async function CompanyLayout({ children, params }: LayoutProps) {
  const { companySlug } = await params;
  const company = await merchantService.getCompanyBySlug(companySlug);

  if (!company) {
    notFound();
  }

  const isTrial = company.tenant.subscriptionStatus === "trial";

  // Use company info for brand-level pages
  const defaultTipConfig = {
    mode: "percentage" as const,
    tiers: [0.15, 0.18, 0.2],
    allowCustom: true,
  };

  return (
    <ThemeProvider preset={company.settings?.themePreset}>
      {isTrial && company.slug && <ClaimBar tenantId={company.tenantId} companySlug={company.slug} />}
      <MerchantProvider
        config={{
          name: company.name,
          logoUrl: company.logoUrl ?? null,
          currency: "USD",
          locale: "en-US",
          timezone: "America/New_York",
          tipConfig: defaultTipConfig,
          companySlug: company.slug,
          tenantId: company.tenantId,
        }}
      >
        <LoyaltyProvider>{children}</LoyaltyProvider>
      </MerchantProvider>
    </ThemeProvider>
  );
}
