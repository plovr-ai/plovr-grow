import { merchantService } from "@/services/merchant";
import { loyaltyConfigService } from "@/services/loyalty";
import { notFound } from "next/navigation";
import { CateringPageClient } from "@storefront/components/catering/CateringPageClient";
import { Navigation, Footer } from "@storefront/components/website";

interface CateringPageProps {
  params: Promise<{
    merchantSlug: string;
  }>;
}

export default async function CateringPage({ params }: CateringPageProps) {
  const { merchantSlug } = await params;

  // Get merchant data
  const merchant = await merchantService.getMerchantBySlug(merchantSlug);
  if (!merchant) {
    notFound();
  }

  // Get website display data for Footer
  const websiteData = await merchantService.getWebsiteData(merchantSlug);
  if (!websiteData) {
    notFound();
  }

  // Check if loyalty is enabled for this company
  const isLoyaltyEnabled = await loyaltyConfigService.isLoyaltyEnabled(
    merchant.tenant.tenantId
  );

  // Build navigation links (merchant-level)
  const menuLink = `/r/${merchantSlug}/menu`;
  const cateringLink = `/r/${merchantSlug}/catering`;

  return (
    <main className="min-h-screen">
      <Navigation
        logo={websiteData.logo}
        restaurantName={merchant.tenant.name}
        companySlug={merchant.tenant.slug ?? undefined}
        menuLink={menuLink}
        cateringLink={cateringLink}
        isLoyaltyEnabled={isLoyaltyEnabled}
      />

      {/* Page header section */}
      <section className="bg-white border-b pt-20">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Catering Services
          </h1>
          <p className="mt-2 text-gray-600">
            Planning an event? Let {merchant.name} cater your next gathering!
          </p>
        </div>
      </section>

      {/* Form section */}
      <section className="bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <CateringPageClient merchantSlug={merchantSlug} />
        </div>
      </section>

      <Footer
        merchant={websiteData}
        companySlug={merchant.tenant.slug ?? undefined}
        menuLink={menuLink}
      />
    </main>
  );
}
