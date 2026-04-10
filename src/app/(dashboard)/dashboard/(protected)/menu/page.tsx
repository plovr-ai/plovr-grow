import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { menuService } from "@/services/menu/menu.service";
import { taxConfigService } from "@/services/menu/tax-config.service";
import { MenuManagementClient } from "@/components/dashboard/menu/MenuManagementClient";

interface MenuManagementPageProps {
  searchParams: Promise<{
    menu?: string;
    archived?: string;
  }>;
}

export default async function MenuManagementPage({
  searchParams,
}: MenuManagementPageProps) {
  const session = await auth();

  if (!session?.user?.tenantId) {
    redirect("/dashboard/login");
  }

  const { tenantId } = session.user;
  const { menu: menuId, archived } = await searchParams;
  const showArchived = archived === "true";

  // Get menu data and tax configs in parallel
  const [menuData, taxConfigs] = await Promise.all([
    menuService.getMenuForDashboard(tenantId, menuId, showArchived),
    taxConfigService.getTaxConfigs(tenantId),
  ]);

  // Transform tax configs for the form
  const taxConfigOptions = taxConfigs.map((tc) => ({
    id: tc.id,
    name: tc.name,
    description: tc.description,
  }));

  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center">Loading...</div>}>
      <MenuManagementClient
        menus={menuData.menus}
        currentMenuId={menuData.currentMenuId}
        categories={menuData.categories}
        taxConfigs={taxConfigOptions}
        showArchived={showArchived}
      />
    </Suspense>
  );
}
