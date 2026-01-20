import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { orderService } from "@/services/order";
import { menuService } from "@/services/menu";
import { DashboardOrderDetailClient } from "@/components/orders/DashboardOrderDetailClient";
import type { OrderItemData, DeliveryAddress } from "@/types";

interface PageProps {
  params: Promise<{ orderId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { orderId } = await params;
  return {
    title: `Order Details | Dashboard`,
    description: `View details for order ${orderId}`,
  };
}

export default async function DashboardOrderDetailPage({ params }: PageProps) {
  const { orderId } = await params;
  const session = await auth();

  // Verify session
  if (!session?.user?.tenantId || !session?.user?.companyId) {
    redirect("/dashboard/login");
  }

  const { tenantId, companyId } = session.user;

  // Fetch order with timeline
  const order = await orderService.getOrderWithTimeline(tenantId, orderId);

  // Validate order exists
  if (!order) {
    notFound();
  }

  // Validate order belongs to this company (via merchant.companyId)
  // We need to fetch the merchant to check companyId
  const merchant = order.merchant;
  if (!merchant) {
    notFound();
  }

  // Get merchant's companyId from merchant service (use getMerchant with tenantId for proper tenant isolation)
  const { merchantService } = await import("@/services/merchant");
  const fullMerchant = await merchantService.getMerchant(tenantId, merchant.id);
  if (!fullMerchant || fullMerchant.companyId !== companyId) {
    notFound();
  }

  // Get order items and fetch images from menu service
  const items = order.items as OrderItemData[];
  const menuItemIds = items.map((item) => item.menuItemId);
  const menuItems = await menuService.getMenuItemsByIds(tenantId, merchant.id, menuItemIds);

  // Build image map
  const imageMap: Record<string, string | null> = {};
  menuItems.forEach((item) => {
    imageMap[item.id] = item.imageUrl;
  });

  // Transform order data for the client component
  const orderData = {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    orderType: order.orderType,
    items,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerEmail: order.customerEmail,
    deliveryAddress: order.deliveryAddress as DeliveryAddress | null,
    notes: order.notes,
    subtotal: Number(order.subtotal),
    taxAmount: Number(order.taxAmount),
    tipAmount: Number(order.tipAmount),
    deliveryFee: Number(order.deliveryFee),
    discount: Number(order.discount),
    totalAmount: Number(order.totalAmount),
    createdAt: order.createdAt,
    confirmedAt: order.confirmedAt,
    completedAt: order.completedAt,
    cancelledAt: order.cancelledAt,
    cancelReason: order.cancelReason,
    timeline: order.timeline.map((event) => ({
      status: event.status,
      timestamp: event.timestamp,
    })),
    merchant: {
      id: merchant.id,
      name: merchant.name,
      slug: merchant.slug,
      timezone: merchant.timezone,
    },
  };

  return <DashboardOrderDetailClient order={orderData} imageMap={imageMap} />;
}
