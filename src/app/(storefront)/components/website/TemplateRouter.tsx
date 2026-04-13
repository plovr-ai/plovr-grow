import type { WebsiteTemplateName } from "@/types/website-template";
import type { WebsiteMerchantData } from "@/services/merchant/merchant.types";
import type { FeaturedItem } from "@/types/website";
import { CasualPage } from "./templates/casual/CasualPage";
import { FineDiningPage } from "./templates/fine-dining/FineDiningPage";
import { FastCasualPage } from "./templates/fast-casual/FastCasualPage";
import { CafeBakeryPage } from "./templates/cafe-bakery/CafeBakeryPage";
import { BarLoungePage } from "./templates/bar-lounge/BarLoungePage";

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
      return <CafeBakeryPage {...props} />;
    case "bar_lounge":
      return <BarLoungePage {...props} />;
    case "casual":
    default:
      return <CasualPage {...props} />;
  }
}
