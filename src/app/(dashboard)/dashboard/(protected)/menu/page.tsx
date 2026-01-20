import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { menuService } from "@/services/menu/menu.service";
import { taxConfigService } from "@/services/menu/tax-config.service";
import { MenuManagementClient } from "@/components/dashboard/menu/MenuManagementClient";

export default async function MenuManagementPage() {
  const session = await auth();

  if (!session?.user?.tenantId || !session?.user?.companyId) {
    redirect("/dashboard/login");
  }

  const { tenantId, companyId } = session.user;

  // Get menu data and tax configs in parallel
  const [menuData, taxConfigs] = await Promise.all([
    menuService.getMenuForDashboard(tenantId, companyId),
    taxConfigService.getTaxConfigs(tenantId, companyId),
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
        categories={menuData.categories}
        taxConfigs={taxConfigOptions}
      />
    </Suspense>
  );
}
