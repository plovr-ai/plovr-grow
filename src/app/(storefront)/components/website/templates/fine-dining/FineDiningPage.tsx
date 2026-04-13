import type { TemplatePageProps } from "../../TemplateRouter";
import { HeroSection } from "./HeroSection";
import { AboutSection } from "./AboutSection";
import { MenuHighlights } from "./MenuHighlights";
import { TestimonialsSection } from "./TestimonialsSection";
import { FooterSection } from "./FooterSection";

export function FineDiningPage({
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
      <AboutSection tagline={websiteData.tagline} />
      <MenuHighlights
        items={featuredItems}
        menuLink={menuLink}
        currency={websiteData.currency}
        locale={websiteData.locale}
      />
      <TestimonialsSection reviews={reviews} />
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
