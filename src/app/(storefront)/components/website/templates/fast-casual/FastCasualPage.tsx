import type { TemplatePageProps } from "../../TemplateRouter";
import { HeroSection } from "./HeroSection";
import { PopularItems } from "./PopularItems";
import { QuickInfo } from "./QuickInfo";
import { FooterSection } from "./FooterSection";

export function FastCasualPage({
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

  return (
    <>
      <HeroSection merchant={merchantInfo} menuLink={menuLink} />
      <PopularItems items={featuredItems} menuLink={menuLink} />
      <QuickInfo merchant={merchantInfo} />
      <FooterSection merchant={merchantInfo} />
    </>
  );
}
