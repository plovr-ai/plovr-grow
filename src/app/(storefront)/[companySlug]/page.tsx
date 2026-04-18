import { notFound } from "next/navigation";
import {
  Navigation,
  TemplateRouter,
} from "@storefront/components/website";
import { merchantService } from "@/services/merchant";
import { loyaltyConfigService } from "@/services/loyalty";

interface PageProps {
  params: Promise<{ companySlug: string }>;
}

export default async function CompanyHomePage({ params }: PageProps) {
  const { companySlug } = await params;
  const company = await merchantService.getTenantBySlug(companySlug);

  if (!company) {
    notFound();
  }

  // Get website display data and featured items in parallel.
  // The loyalty-enabled flag is kicked off but NOT awaited — it's passed
  // as a Promise to <Navigation>, which streams the loyalty-gated UI in
  // via a <Suspense> boundary once it resolves.
  const isLoyaltyEnabledPromise = loyaltyConfigService.isLoyaltyEnabled(
    company.tenantId
  );
  const [websiteData, featuredItems] = await Promise.all([
    merchantService.getTenantWebsiteBasics(companySlug),
    merchantService.getTenantFeaturedItems(company.tenantId),
  ]);
  if (!websiteData) {
    notFound();
  }

  // Determine the menu and catering links:
  // - If single merchant, link directly to that merchant's menu/catering
  // - If multiple merchants, link to locations page
  const locationCount = company.merchants.length;
  const hasSingleMerchant = locationCount === 1;
  const menuLink = hasSingleMerchant
    ? `/r/${company.merchants[0].slug}/menu`
    : `/${companySlug}/locations`;
  const cateringLink = hasSingleMerchant
    ? `/r/${company.merchants[0].slug}/catering`
    : `/${companySlug}/locations`;

  return (
    <main className="min-h-screen">
      <Navigation
        logo={websiteData.logo}
        restaurantName={company.name}
        companySlug={companySlug}
        menuLink={menuLink}
        cateringLink={cateringLink}
        isLoyaltyEnabledPromise={isLoyaltyEnabledPromise}
      />
      <TemplateRouter
        template={websiteData.websiteTemplate}
        websiteData={websiteData}
        featuredItems={featuredItems}
        companySlug={companySlug}
        merchantSlug={hasSingleMerchant ? company.merchants[0].slug : ""}
        locationCount={locationCount}
      />
    </main>
  );
}
