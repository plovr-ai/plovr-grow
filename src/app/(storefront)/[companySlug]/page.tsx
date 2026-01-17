import { notFound } from "next/navigation";
import {
  Navigation,
  HeroBanner,
  FeaturedItems,
  CustomerReviews,
  Footer,
} from "@storefront/components/website";
import { getMockWebsiteData } from "@/data/mock/website";
import { getCompanyBySlug } from "@/lib/tenant";

interface PageProps {
  params: Promise<{ companySlug: string }>;
}

export default async function CompanyHomePage({ params }: PageProps) {
  const { companySlug } = await params;
  const company = await getCompanyBySlug(companySlug);

  if (!company) {
    notFound();
  }

  // Get website display data (mock for now)
  const data = getMockWebsiteData(companySlug);

  // Determine the menu link:
  // - If single merchant, link directly to that merchant's menu
  // - If multiple merchants, link to locations page
  const hasSingleMerchant = company.merchants.length === 1;
  const menuLink = hasSingleMerchant
    ? `/r/${company.merchants[0].slug}/menu`
    : `/${companySlug}/locations`;

  return (
    <main className="min-h-screen">
      <Navigation
        logo={data.merchant.logo}
        restaurantName={company.name}
        companySlug={companySlug}
        menuLink={menuLink}
      />
      <HeroBanner
        merchant={data.merchant}
        companySlug={companySlug}
        menuLink={menuLink}
      />
      <FeaturedItems items={data.featuredItems} />
      <CustomerReviews reviews={data.reviews} />
      <Footer
        merchant={data.merchant}
        companySlug={companySlug}
        menuLink={menuLink}
      />
    </main>
  );
}
