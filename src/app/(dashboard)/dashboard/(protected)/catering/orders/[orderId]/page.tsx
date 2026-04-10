import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { cateringOrderService } from "@/services/catering";
import { CateringOrderDetail } from "@/components/dashboard/catering/CateringOrderDetail";

interface CateringOrderDetailPageProps {
  params: Promise<{ orderId: string }>;
}

export default async function CateringOrderDetailPage({
  params,
}: CateringOrderDetailPageProps) {
  const { orderId } = await params;
  const session = await auth();

  // Verify session
  if (!session?.user?.tenantId) {
    redirect("/dashboard/login");
  }

  const { tenantId } = session.user;

  // Fetch order details
  const order = await cateringOrderService.getOrder(tenantId, orderId);

  if (!order) {
    notFound();
  }

  return (
    <CateringOrderDetail
      order={{
        ...order,
        subtotal: order.subtotal,
        taxAmount: order.taxAmount,
        serviceCharge: order.serviceCharge,
        totalAmount: order.totalAmount,
      }}
    />
  );
}
