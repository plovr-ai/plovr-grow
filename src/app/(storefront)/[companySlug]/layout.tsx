import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCompanyBySlug } from "@/lib/tenant";
import { MerchantProvider } from "@/contexts";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ companySlug: string }>;
}

export async function generateMetadata({
  params,
}: LayoutProps): Promise<Metadata> {
  const { companySlug } = await params;
  const company = await getCompanyBySlug(companySlug);

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
  const company = await getCompanyBySlug(companySlug);

  if (!company) {
    notFound();
  }

  // Use first merchant's config for brand-level pages, or defaults
  const firstMerchant = company.merchants[0];
  const defaultConfig = {
    currency: "USD",
    locale: "en-US",
    tipConfig: {
      mode: "percentage" as const,
      tiers: [0.15, 0.18, 0.2],
      allowCustom: true,
    },
  };

  return (
    <MerchantProvider
      config={
        firstMerchant
          ? {
              currency: "USD",
              locale: "en-US",
              tipConfig: defaultConfig.tipConfig,
            }
          : defaultConfig
      }
    >
      {children}
    </MerchantProvider>
  );
}
