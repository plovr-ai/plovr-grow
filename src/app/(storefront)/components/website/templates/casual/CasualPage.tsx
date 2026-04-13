import type { TemplatePageProps } from "../../TemplateRouter";
import { HeroSection } from "./HeroSection";
import { FeaturedItems } from "./FeaturedItems";
import { ReviewsSection } from "./ReviewsSection";
import { FooterSection } from "./FooterSection";

export function CasualPage({
  websiteData,
  featuredItems,
  companySlug,
  merchantSlug,
  locationCount,
}: TemplatePageProps) {
  const hasSingleMerchant = locationCount === 1;
  const menuLink = hasSingleMerchant
    ? `/r/${merchantSlug}/menu`
    : `/${companySlug}/locations`;

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

  const singleLocation = hasSingleMerchant
    ? {
        address: websiteData.address,
        city: websiteData.city,
        state: websiteData.state,
        zipCode: websiteData.zipCode,
      }
    : undefined;

  const reviews = websiteData.reviews || [];

  return (
    <>
      <HeroSection
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
      <ReviewsSection reviews={reviews} />
      <FooterSection
        merchant={merchantInfo}
        companySlug={companySlug}
        menuLink={menuLink}
      />
    </>
  );
}
