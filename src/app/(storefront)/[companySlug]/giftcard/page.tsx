import { notFound } from "next/navigation";
import { merchantService } from "@/services/merchant";
import { loyaltyConfigService } from "@/services/loyalty";
import { MerchantProvider } from "@/contexts";
import { GiftcardPageClient } from "@storefront/components/giftcard";
import { Navigation, Footer } from "@storefront/components/website";

export default async function GiftcardPage({
  params
}: {
  params: Promise<{ companySlug: string }>
}) {
  const { companySlug } = await params;

  // Get company data
  const company = await merchantService.getCompanyBySlug(companySlug);
  if (!company) notFound();

  // Get website data for Navigation/Footer
  const websiteData = await merchantService.getCompanyWebsiteData(companySlug);
  if (!websiteData) notFound();

  // Check if loyalty is enabled
  const isLoyaltyEnabled = await loyaltyConfigService.isLoyaltyEnabled(
    company.tenantId,
    company.id
  );

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

  // Get currency/locale from first merchant or use defaults
  const firstMerchant = company.merchants[0];
  const currency = firstMerchant?.currency ?? "USD";
  const locale = firstMerchant?.locale ?? "en-US";
  const timezone = firstMerchant?.timezone ?? "America/New_York";

  // Build navigation links (handle single vs multi-merchant)
  const hasSingleMerchant = company.merchants.length === 1;
  const menuLink = hasSingleMerchant
    ? `/r/${company.merchants[0].slug}/menu`
    : `/${companySlug}/locations`;
  const cateringLink = hasSingleMerchant
    ? `/r/${company.merchants[0].slug}/catering`
    : `/${companySlug}/locations`;

  return (
    <MerchantProvider config={{
      name: company.name,
      logoUrl: company.logoUrl ?? null,
      currency,
      locale,
      timezone,
      companySlug,
    }}>
      <main className="min-h-screen">
        <Navigation
          logo={websiteData.logo}
          restaurantName={company.name}
          companySlug={companySlug}
          menuLink={menuLink}
          cateringLink={cateringLink}
          isLoyaltyEnabled={isLoyaltyEnabled}
        />

        <section className="bg-white border-b pt-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Gift Cards
            </h1>
            <p className="text-gray-600">
              Give the gift of {company.name}. Perfect for any occasion!
            </p>
          </div>
        </section>

        <section className="bg-gray-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <GiftcardPageClient
              companySlug={companySlug}
              companyName={company.name}
              config={giftcardConfig}
            />
          </div>
        </section>

        <Footer
          merchant={websiteData}
          companySlug={companySlug}
          menuLink={menuLink}
        />
      </main>
    </MerchantProvider>
  );
}
