import { notFound } from "next/navigation";
import { menuService } from "@/services/menu";
import { merchantService } from "@/services/merchant";
import { MenuPageClient } from "@storefront/components/menu";
import {
  convertToMenuDisplayData,
  type GetMenuResponseWithItemCount,
} from "./utils";

interface MenuPageProps {
  params: Promise<{ merchantSlug: string }>;
  searchParams: Promise<{ menu?: string }>;
}

export default async function MenuPage({ params, searchParams }: MenuPageProps) {
  const { merchantSlug } = await params;
  const { menu: menuId } = await searchParams;

  // Resolve slug to merchant with tenant info
  const merchant = await merchantService.getMerchantBySlug(merchantSlug);
  if (!merchant) {
    notFound();
  }

  const tenantId = merchant.tenant.tenantId;
  const response = await menuService.getMenu(tenantId, merchant.id, menuId);

  // Get item counts for all menus to filter empty ones
  const menusWithItemCount = await Promise.all(
    response.menus.map(async (menu) => {
      if (menu.id === response.currentMenuId) {
        // Current menu: use existing categories data
        const itemCount = response.categories.reduce(
          (sum, cat) => sum + cat.menuItems.length,
          0
        );
        return { id: menu.id, name: menu.name, itemCount };
      }
      // Other menus: fetch their categories to count items
      const menuData = await menuService.getMenu(tenantId, merchant.id, menu.id);
      const itemCount = menuData.categories.reduce(
        (sum, cat) => sum + cat.menuItems.length,
        0
      );
      return { id: menu.id, name: menu.name, itemCount };
    })
  );

  // Build response with itemCount for filtering
  const responseWithItemCount: GetMenuResponseWithItemCount = {
    ...response,
    menus: menusWithItemCount,
  };

  const data = convertToMenuDisplayData(responseWithItemCount, merchant.tenant.slug ?? "");

  return <MenuPageClient data={data} merchantSlug={merchantSlug} />;
}
