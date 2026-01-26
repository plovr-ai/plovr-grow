import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { menuService } from "@/services/menu/menu.service";
import { taxConfigService } from "@/services/menu/tax-config.service";
import { MenuItemFormPage } from "@/components/dashboard/menu/MenuItemFormPage";

interface PageProps {
  params: Promise<{ itemId: string }>;
  searchParams: Promise<{ menuId?: string }>;
}

export default async function EditMenuItemPage({ params, searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user?.tenantId || !session?.user?.companyId) {
    redirect("/dashboard/login");
  }

  const { tenantId, companyId } = session.user;
  const { itemId } = await params;
  const { menuId } = await searchParams;

  // Get menu data and tax configs
  // Pass menuId to get the correct menu's categories
  const [menuData, taxConfigs] = await Promise.all([
    menuService.getMenuForDashboard(tenantId, companyId, menuId),
    taxConfigService.getTaxConfigs(tenantId, companyId),
  ]);

  // Find the item and its category
  let foundItem = null;
  let foundCategory = null;

  for (const category of menuData.categories) {
    const item = category.menuItems.find((i) => i.id === itemId);
    if (item) {
      foundItem = item;
      foundCategory = category;
      break;
    }
  }

  if (!foundItem || !foundCategory) {
    notFound();
  }

  const taxConfigOptions = taxConfigs.map((tc) => ({
    id: tc.id,
    name: tc.name,
    description: tc.description,
  }));

  return (
    <MenuItemFormPage
      item={foundItem}
      categoryId={foundCategory.id}
      categoryName={foundCategory.name}
      categories={menuData.categories}
      taxConfigs={taxConfigOptions}
    />
  );
}
