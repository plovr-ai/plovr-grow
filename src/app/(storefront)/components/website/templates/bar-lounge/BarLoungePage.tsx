import type { TemplatePageProps } from "../../TemplateRouter";
import { HeroSection } from "./HeroSection";
import { DrinksShowcase } from "./DrinksShowcase";
import { AtmosphereGallery } from "./AtmosphereGallery";
import { ReviewsSection } from "./ReviewsSection";
import { FooterSection } from "./FooterSection";

export function BarLoungePage({
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

  const reviews = websiteData.reviews || [];

  return (
    <>
      <HeroSection
        name={websiteData.name}
        tagline={websiteData.tagline}
        heroImage={websiteData.heroImage}
      />
      <DrinksShowcase
        items={featuredItems}
        menuLink={menuLink}
        currency={websiteData.currency}
        locale={websiteData.locale}
      />
      <AtmosphereGallery
        heroImage={websiteData.heroImage}
        items={featuredItems}
      />
      <ReviewsSection reviews={reviews} />
      <FooterSection
        name={websiteData.name}
        address={websiteData.address}
        city={websiteData.city}
        state={websiteData.state}
        zipCode={websiteData.zipCode}
        phone={websiteData.phone}
        businessHours={websiteData.businessHours}
        socialLinks={websiteData.socialLinks}
      />
    </>
  );
}
