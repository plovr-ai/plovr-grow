import type { TemplatePageProps } from "../../TemplateRouter";
import { HeroSection } from "./HeroSection";
import { SpecialsSection } from "./SpecialsSection";
import { StorySection } from "./StorySection";
import { ReviewsSection } from "./ReviewsSection";
import { FooterSection } from "./FooterSection";

export function CafeBakeryPage({
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
      <SpecialsSection
        items={featuredItems}
        menuLink={menuLink}
        currency={websiteData.currency}
        locale={websiteData.locale}
      />
      <StorySection tagline={websiteData.tagline} />
      <ReviewsSection reviews={reviews} />
      <FooterSection
        name={websiteData.name}
        logo={websiteData.logo}
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
