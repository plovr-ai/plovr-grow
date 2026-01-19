import { notFound } from "next/navigation";
import {
  Navigation,
  HeroBanner,
  FeaturedItems,
  CustomerReviews,
  Footer,
} from "@storefront/components/website";
import { merchantService } from "@/services/merchant";

interface PageProps {
  params: Promise<{ companySlug: string }>;
}

export default async function CompanyHomePage({ params }: PageProps) {
  const { companySlug } = await params;
  const company = await merchantService.getCompanyBySlug(companySlug);

  if (!company) {
    notFound();
  }

  // Get website display data from database
  const websiteData = await merchantService.getCompanyWebsiteData(companySlug);
  if (!websiteData) {
    notFound();
  }

  // Determine the menu link:
  // - If single merchant, link directly to that merchant's menu
  // - If multiple merchants, link to locations page
  const locationCount = company.merchants.length;
  const hasSingleMerchant = locationCount === 1;
  const menuLink = hasSingleMerchant
    ? `/r/${company.merchants[0].slug}/menu`
    : `/${companySlug}/locations`;

  // Get single location info for hero banner
  const singleLocation = hasSingleMerchant
    ? {
        address: company.merchants[0].address || "",
        city: company.merchants[0].city || "",
        state: company.merchants[0].state || "",
        zipCode: company.merchants[0].zipCode || "",
      }
    : undefined;

  // Convert WebsiteMerchantData to the format expected by components
  const merchantInfo = {
    name: websiteData.name,
    tagline: websiteData.tagline,
    address: websiteData.address,
    city: websiteData.city,
    state: websiteData.state,
    zipCode: websiteData.zipCode,
    phone: websiteData.phone,
    email: websiteData.email,
    logo: websiteData.logo,
    heroImage: websiteData.heroImage,
    businessHours: websiteData.businessHours,
    socialLinks: websiteData.socialLinks,
    currency: websiteData.currency,
    locale: websiteData.locale,
  };

  // Get featured items and reviews from database
  const featuredItems = websiteData.featuredItems || [];
  const reviews = websiteData.reviews || [];

  return (
    <main className="min-h-screen">
      <Navigation
        logo={merchantInfo.logo}
        restaurantName={company.name}
        companySlug={companySlug}
        menuLink={menuLink}
      />
      <HeroBanner
        merchant={merchantInfo}
        companySlug={companySlug}
        menuLink={menuLink}
        locationCount={locationCount}
        singleLocation={singleLocation}
      />
      <FeaturedItems
        items={featuredItems}
        menuLink={menuLink}
        hasMultipleLocations={!hasSingleMerchant}
      />
      <CustomerReviews reviews={reviews} />
      <Footer
        merchant={merchantInfo}
        companySlug={companySlug}
        menuLink={menuLink}
      />
    </main>
  );
}
