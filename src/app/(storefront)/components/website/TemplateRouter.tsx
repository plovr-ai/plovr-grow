import type { WebsiteTemplateName } from "@/types/website-template";
import type { WebsiteMerchantData } from "@/services/merchant/merchant.types";
import type { FeaturedItem } from "@/types/website";
import { CasualPage } from "./templates/casual/CasualPage";
import { FineDiningPage } from "./templates/fine-dining/FineDiningPage";
import { FastCasualPage } from "./templates/fast-casual/FastCasualPage";

export interface TemplatePageProps {
  websiteData: WebsiteMerchantData;
  featuredItems: FeaturedItem[];
  companySlug: string;
  merchantSlug: string;
  locationCount: number;
}

interface TemplateRouterProps extends TemplatePageProps {
  template: WebsiteTemplateName;
}

export function TemplateRouter({ template, ...props }: TemplateRouterProps) {
  switch (template) {
    case "fine_dining":
      return <FineDiningPage {...props} />;
    case "fast_casual":
      return <FastCasualPage {...props} />;
    case "cafe_bakery":
    case "bar_lounge":
    case "casual":
    default:
      return <CasualPage {...props} />;
  }
}
