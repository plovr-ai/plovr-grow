import { notFound } from "next/navigation";
import { menuService } from "@/services/menu";
import { merchantService } from "@/services/merchant";
import { MenuPageClient } from "@storefront/components/menu";
import { convertToMenuDisplayData } from "./utils";

interface MenuPageProps {
  params: Promise<{ merchantSlug: string }>;
}

export default async function MenuPage({ params }: MenuPageProps) {
  const { merchantSlug } = await params;

  // Resolve slug to merchant with tenant info
  const merchant = await merchantService.getMerchantBySlug(merchantSlug);
  if (!merchant) {
    notFound();
  }

  const tenantId = merchant.company.tenantId;
  const response = await menuService.getMenu(tenantId, merchant.id);
  const data = convertToMenuDisplayData(response, merchant.company.slug);

  return <MenuPageClient data={data} merchantSlug={merchantSlug} />;
}
