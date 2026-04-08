import Link from "next/link";
import type { Order } from "@prisma/client";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { PaymentStatusBadge } from "./StatusBadge";
import { formatPrice } from "@/lib/utils";
import { formatDate, formatTime, getTimezoneAbbr } from "@/lib/datetime";
import { formatCustomerName } from "@/lib/names";
import type { OrderMode, OrderStatus, SalesChannel } from "@/types";

// Serialized order type with Decimal fields converted to numbers
type SerializedOrder = Omit<Order, "tenant" | "subtotal" | "taxAmount" | "tipAmount" | "deliveryFee" | "discount" | "giftCardPayment" | "cashPayment" | "totalAmount"> & {
  subtotal: number;
  taxAmount: number;
  tipAmount: number;
  deliveryFee: number;
  discount: number;
  giftCardPayment: number;
  cashPayment: number;
  totalAmount: number;
  merchant?: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
  } | null;
};

interface OrderCardProps {
  order: SerializedOrder;
}

const orderModeLabels: Record<OrderMode, string> = {
  pickup: "Pickup",
  delivery: "Delivery",
  dine_in: "Dine In",
};

const salesChannelLabels: Record<SalesChannel, string> = {
  online_order: "Online Order",
  catering: "Catering",
  giftcard: "Gift Card",
};

export function OrderCard({ order }: OrderCardProps) {
  // items is already parsed by Prisma (JSON field)
  const items = order.items as Array<{
    name: string;
    quantity: number;
  }>;
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  // Get timezone from merchant or use default
  const timezone = order.merchant?.timezone ?? "America/New_York";
  const locale = "en-US";

  // Format date with merchant's timezone
  const createdDate = new Date(order.createdAt);
  const formattedDate = formatDate(createdDate, timezone, locale);
  const formattedTime = formatTime(createdDate, timezone, locale);
  const timezoneAbbr = getTimezoneAbbr(timezone, createdDate);

  return (
    <Link href={`/dashboard/orders/${order.id}`} className="block">
      <Card className="hover:shadow-lg transition-shadow cursor-pointer gap-3 !py-4">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-lg">#{order.orderNumber}</h3>
              <p className="text-sm text-gray-600 mt-1">
                {formattedDate} at {formattedTime} {timezoneAbbr}
              </p>
            </div>
            <PaymentStatusBadge status={order.status as OrderStatus} />
          </div>
        </CardHeader>

        <CardContent className="space-y-2 text-sm">
          <div className="font-medium">{formatCustomerName(order.customerFirstName, order.customerLastName)}</div>
          <div className="text-gray-600">{order.customerPhone}</div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
              {orderModeLabels[order.orderMode as OrderMode]}
            </span>
            <span className="inline-flex items-center rounded-md bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
              {salesChannelLabels[order.salesChannel as SalesChannel] || order.salesChannel}
            </span>
            <span className="text-gray-600">{itemCount} item{itemCount !== 1 ? "s" : ""}</span>
          </div>
        </CardContent>

        <CardFooter className="!pt-2 border-t">
          <div className="flex items-center justify-between w-full">
            <span className="text-sm font-medium text-gray-600">Total:</span>
            <span className="text-base font-bold">
              {formatPrice(order.totalAmount, "USD", "en-US")}
            </span>
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
}
