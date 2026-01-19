import type { Order } from "@prisma/client";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { StatusBadge } from "./StatusBadge";
import { formatPrice } from "@/lib/utils";
import type { OrderType, OrderStatus } from "@/types";

interface OrderCardProps {
  order: Omit<Order, "tenant">;
}

const orderTypeLabels: Record<OrderType, string> = {
  pickup: "Pickup",
  delivery: "Delivery",
  dine_in: "Dine In",
};

export function OrderCard({ order }: OrderCardProps) {
  // items is already parsed by Prisma (JSON field)
  const items = order.items as Array<{
    name: string;
    quantity: number;
  }>;
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  // Format date
  const createdDate = new Date(order.createdAt);
  const formattedDate = createdDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const formattedTime = createdDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <Card className="hover:shadow-lg transition-shadow cursor-pointer gap-3 !py-4">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-lg">#{order.orderNumber}</h3>
            <p className="text-sm text-gray-600 mt-1">
              {formattedDate} at {formattedTime}
            </p>
          </div>
          <StatusBadge status={order.status as OrderStatus} />
        </div>
      </CardHeader>

      <CardContent className="space-y-2 text-sm">
        <div className="font-medium">{order.customerName}</div>
        <div className="text-gray-600">{order.customerPhone}</div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
            {orderTypeLabels[order.orderType as OrderType]}
          </span>
          <span className="text-gray-600">{itemCount} item{itemCount !== 1 ? "s" : ""}</span>
        </div>
      </CardContent>

      <CardFooter className="!pt-2 border-t">
        <div className="flex items-center justify-between w-full">
          <span className="text-sm font-medium text-gray-600">Total:</span>
          <span className="text-base font-bold">
            {formatPrice(Number(order.totalAmount), "USD", "en-US")}
          </span>
        </div>
      </CardFooter>
    </Card>
  );
}
