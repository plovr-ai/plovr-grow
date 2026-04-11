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

  // getMenu() injects a synthetic "Featured" category only for the first
  // menu in response.menus. If we are viewing a different menu, that first
  // menu's regular-item count alone can under-report (a first menu with no
  // regular items but some featured items should still appear in the
  // switcher). Pull the featured count in parallel and add it in.
  const firstMenuId = response.menus[0]?.id;
  const firstMenuIsOther =
    firstMenuId !== undefined && firstMenuId !== response.currentMenuId;

  const [otherCounts, featuredCountForFirstMenu] = await Promise.all([
    otherMenuIds.length
      ? menuService.countActiveItemsByMenuIds(tenantId, otherMenuIds)
      : Promise.resolve(new Map<string, number>()),
    firstMenuIsOther
      ? menuService.countActiveFeaturedItems(tenantId)
      : Promise.resolve(0),
  ]);

  if (firstMenuIsOther && featuredCountForFirstMenu > 0) {
    otherCounts.set(
      firstMenuId,
      (otherCounts.get(firstMenuId) ?? 0) + featuredCountForFirstMenu
    );
  }

  // Current menu: reuse already-fetched categories (no extra DB call).
  // When viewing the first menu, `response.categories` already contains the
  // synthetic Featured category (if any), so this sum correctly includes
  // featured items without an extra query.
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
