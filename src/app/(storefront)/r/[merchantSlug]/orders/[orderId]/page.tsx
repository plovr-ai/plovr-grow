import { Metadata } from "next";
import { notFound } from "next/navigation";
import { orderService } from "@/services/order";
import { merchantService } from "@/services/merchant";
import { OrderDetailClient } from "@storefront/components/orders";
import type { OrderDetailData } from "@storefront/components/orders";
import type { OrderItemData } from "@/types";

interface PageProps {
  params: Promise<{ merchantSlug: string; orderId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { orderId } = await params;
  return {
    title: `Order Details | Order`,
    description: `View details for order ${orderId}`,
  };
}

export default async function OrderDetailPage({ params }: PageProps) {
  const { merchantSlug, orderId } = await params;

  // Get merchant by slug
  const merchant = await merchantService.getMerchantBySlug(merchantSlug);
  if (!merchant) {
    notFound();
  }

  // Get tenantId from merchant -> company -> tenant chain
  const tenantId = merchant.company.tenantId;

  // Fetch order with timeline
  const order = await orderService.getOrderWithTimeline(tenantId, orderId);

  // Validate order exists and belongs to this merchant
  if (!order || order.merchantId !== merchant.id) {
    notFound();
  }

  // Transform order data for the client component
  const orderData: OrderDetailData = {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status as OrderDetailData["status"],
    orderType: order.orderType as OrderDetailData["orderType"],
    items: order.items as unknown as OrderItemData[],
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerEmail: order.customerEmail,
    deliveryAddress: order.deliveryAddress as OrderDetailData["deliveryAddress"],
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
    merchant: order.merchant,
  };

  return <OrderDetailClient order={orderData} merchantSlug={merchantSlug} />;
}
