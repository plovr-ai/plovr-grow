import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { merchantService } from "@/services/merchant";
import { menuService } from "@/services/menu";
import { cateringService } from "@/services/catering";
import { CateringOrderForm } from "@/components/dashboard/catering/CateringOrderForm";

interface NewCateringOrderPageProps {
  searchParams: Promise<{
    merchantId?: string;
    leadId?: string;
    eventDate?: string;
  }>;
}

export default async function NewCateringOrderPage({
  searchParams,
}: NewCateringOrderPageProps) {
  const search = await searchParams;
  const session = await auth();

  // Verify session
  if (!session?.user?.tenantId || !session?.user?.companyId) {
    redirect("/dashboard/login");
  }

  const { tenantId, companyId } = session.user;

  // Fetch merchants
  const merchants = await merchantService.getMerchantsByCompanyId(
    tenantId,
    companyId
  );

  // Get selected merchant (or first one)
  const selectedMerchantId = search.merchantId || merchants[0]?.id;
  const selectedMerchant = merchants.find((m) => m.id === selectedMerchantId) || merchants[0];

  if (!selectedMerchant) {
    redirect("/dashboard");
  }

  // Fetch all menus for the company
  const allMenus = await menuService.getMenus(tenantId, companyId);
  const activeMenus = allMenus.filter((m) => m.status === "active");

  // Fetch menu items for all menus
  const menuItemsPromises = activeMenus.map(async (menu) => {
    const menuData = await menuService.getMenu(tenantId, selectedMerchant.id, menu.id);
    return menuData.categories.flatMap((cat) =>
      cat.menuItems.map((item) => ({
        id: item.id,
        name: item.name,
        price: Number(item.price),
        categoryId: cat.id,
        categoryName: cat.name,
        menuId: menu.id,
      }))
    );
  });

  const menuItemsArrays = await Promise.all(menuItemsPromises);
  const menuItems = menuItemsArrays.flat();

  // Fetch lead data if leadId is provided
  let initialData:
    | {
        customerFirstName: string;
        customerLastName: string;
        customerPhone: string;
        customerEmail: string;
      }
    | undefined;

  if (search.leadId) {
    const lead = await cateringService.getLeadById(tenantId, search.leadId);
    if (lead) {
      initialData = {
        customerFirstName: lead.firstName,
        customerLastName: lead.lastName,
        customerPhone: lead.phone,
        customerEmail: lead.email,
      };
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">New Catering Order</h2>
        <p className="text-sm text-gray-500">
          Create a new catering order and send an invoice to the customer
        </p>
      </div>

      <CateringOrderForm
        merchants={merchants.map((m) => ({
          id: m.id,
          name: m.name,
          taxRate: Number(m.taxRate),
          currency: m.currency,
          locale: m.locale,
        }))}
        selectedMerchantId={selectedMerchantId}
        menus={activeMenus.map((m) => ({ id: m.id, name: m.name }))}
        menuItems={menuItems}
        leadId={search.leadId}
        initialEventDate={search.eventDate}
        initialData={initialData}
      />
    </div>
  );
}
