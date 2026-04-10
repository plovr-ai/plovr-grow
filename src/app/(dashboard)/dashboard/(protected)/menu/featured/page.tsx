import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { menuService } from "@/services/menu/menu.service";
import { FeaturedItemsClient } from "@/components/dashboard/menu/FeaturedItemsClient";

export default async function FeaturedItemsPage() {
  const session = await auth();

  if (!session?.user?.tenantId) {
    redirect("/dashboard/login");
  }

  const { tenantId } = session.user;

  // Get featured items and all menu data in parallel
  const [featuredItems, menuData] = await Promise.all([
    menuService.getFeaturedItems(tenantId),
    menuService.getMenuForDashboard(tenantId),
  ]);

  // Get all active items from all categories
  const allItems = menuData.categories.flatMap((category) =>
    category.menuItems
      .filter((item) => item.status === "active")
      .map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        imageUrl: item.imageUrl,
        categoryName: category.name,
      }))
  );

  // Remove duplicates (items can be in multiple categories)
  const uniqueItems = allItems.filter(
    (item, index, self) => self.findIndex((i) => i.id === item.id) === index
  );

  // Get featured item IDs for easier lookup
  const featuredItemIds = new Set(featuredItems.map((fi) => fi.menuItemId));

  // Split into selected and available
  const selectedItems = featuredItems.map((fi) => ({
    id: fi.menuItemId,
    name: fi.menuItem.name,
    description: fi.menuItem.description,
    price: fi.menuItem.price,
    imageUrl: fi.menuItem.imageUrl,
  }));

  const availableItems = uniqueItems.filter(
    (item) => !featuredItemIds.has(item.id)
  );

  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          Loading...
        </div>
      }
    >
      <FeaturedItemsClient
        selectedItems={selectedItems}
        availableItems={availableItems}
      />
    </Suspense>
  );
}
