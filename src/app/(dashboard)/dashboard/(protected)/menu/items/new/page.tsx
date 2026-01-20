import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { menuService } from "@/services/menu/menu.service";
import { taxConfigService } from "@/services/menu/tax-config.service";
import { MenuItemFormPage } from "@/components/dashboard/menu/MenuItemFormPage";

interface PageProps {
  searchParams: Promise<{ categoryId?: string }>;
}

export default async function NewMenuItemPage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user?.tenantId || !session?.user?.companyId) {
    redirect("/dashboard/login");
  }

  const { tenantId, companyId } = session.user;
  const params = await searchParams;
  const categoryId = params.categoryId;

  if (!categoryId) {
    redirect("/dashboard/menu");
  }

  // Get menu data to verify category exists and get tax configs
  const [menuData, taxConfigs] = await Promise.all([
    menuService.getMenuForDashboard(tenantId, companyId),
    taxConfigService.getTaxConfigs(tenantId, companyId),
  ]);

  // Find the category
  const category = menuData.categories.find((c) => c.id === categoryId);
  if (!category) {
    redirect("/dashboard/menu");
  }

  const taxConfigOptions = taxConfigs.map((tc) => ({
    id: tc.id,
    name: tc.name,
    description: tc.description,
  }));

  return (
    <MenuItemFormPage
      item={null}
      categoryId={categoryId}
      categoryName={category.name}
      taxConfigs={taxConfigOptions}
    />
  );
}
