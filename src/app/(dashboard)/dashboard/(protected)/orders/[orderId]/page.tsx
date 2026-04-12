import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { orderService } from "@/services/order";
import { menuService } from "@/services/menu";
import { DashboardOrderDetailClient } from "@/components/orders/DashboardOrderDetailClient";
import type { DeliveryAddress } from "@/types";

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
  if (!session?.user?.tenantId) {
    redirect("/dashboard/login");
  }

  const { tenantId } = session.user;

  // Fetch order with timeline
  const order = await orderService.getOrderWithTimeline(tenantId, orderId);

  // Validate order exists
  if (!order) {
    notFound();
  }

  // Validate order belongs to this tenant (via merchant)
  const merchant = order.merchant;
  if (!merchant) {
    notFound();
  }

  // Verify merchant belongs to this tenant (getMerchant already checks tenant isolation)
  const { merchantService } = await import("@/services/merchant");
  const fullMerchant = await merchantService.getMerchant(tenantId, merchant.id);
  if (!fullMerchant) {
    notFound();
  }

  // Get order items (mapped from structured OrderItem rows by the service)
  const items = order.items;
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
    fulfillmentStatus: order.fulfillmentStatus,
    orderMode: order.orderMode,
    salesChannel: order.salesChannel,
    items,
    customerFirstName: order.customerFirstName,
    customerLastName: order.customerLastName,
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
    paidAt: order.paidAt,
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
