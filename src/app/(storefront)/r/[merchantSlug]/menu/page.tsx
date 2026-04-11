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

  // Fetch the current menu with full data. Pass preloaded merchant so the
  // service doesn't re-query it by id.
  const response = await menuService.getMenu(tenantId, merchant.id, menuId, {
    preloadedMerchant: {
      id: merchant.id,
      name: merchant.name,
      logoUrl: merchant.logoUrl ?? null,
    },
  });

  // Fetch item counts for the *other* menus in a single aggregate query so we
  // can filter out empty ones in the menu switcher. Previously this was an
  // N+1 that re-ran the full getMenu pipeline once per menu.
  const otherMenuIds = response.menus
    .filter((m) => m.id !== response.currentMenuId)
    .map((m) => m.id);
  const otherCounts = otherMenuIds.length
    ? await menuService.countActiveItemsByMenuIds(tenantId, otherMenuIds)
    : new Map<string, number>();

  // Current menu: reuse already-fetched categories (no extra DB call).
  const currentMenuItemCount = response.categories.reduce(
    (sum, cat) => sum + cat.menuItems.length,
    0
  );

  const menusWithItemCount = response.menus.map((menu) => ({
    id: menu.id,
    name: menu.name,
    itemCount:
      menu.id === response.currentMenuId
        ? currentMenuItemCount
        : otherCounts.get(menu.id) ?? 0,
  }));

  // Build response with itemCount for filtering
  const responseWithItemCount: GetMenuResponseWithItemCount = {
    ...response,
    menus: menusWithItemCount,
  };

  const data = convertToMenuDisplayData(responseWithItemCount, merchant.tenant.slug ?? "");

  return <MenuPageClient data={data} merchantSlug={merchantSlug} />;
}
