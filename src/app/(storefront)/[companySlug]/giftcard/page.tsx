import { notFound } from "next/navigation";
import { merchantService } from "@/services/merchant";
import { MerchantProvider } from "@/contexts";
import { GiftcardPageClient } from "@storefront/components/giftcard";

export default async function GiftcardPage({
  params
}: {
  params: Promise<{ companySlug: string }>
}) {
  const { companySlug } = await params;

  // Get company data
  const company = await merchantService.getCompanyBySlug(companySlug);
  if (!company) notFound();

  // Get giftcard config (default if not configured)
  const giftcardConfig = company.settings?.giftcard || {
    enabled: true,
    denominations: [30, 50, 100],
  };

  if (!giftcardConfig.enabled) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Gift Cards Currently Unavailable</h1>
        <p className="text-gray-600">Please check back later.</p>
      </div>
    );
  }

  return (
    <MerchantProvider config={{ currency: company.currency, locale: company.locale }}>
      <GiftcardPageClient
        companySlug={companySlug}
        companyName={company.name}
        config={giftcardConfig}
      />
    </MerchantProvider>
  );
}
