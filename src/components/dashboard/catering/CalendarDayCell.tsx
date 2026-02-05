"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { format } from "date-fns";
import { formatCustomerName } from "@/lib/names";
import type { CateringOrderData, CateringOrderInvoice } from "@/services/catering/catering-order.types";

type OrderWithMerchant = CateringOrderData & {
  merchant: { id: string; name: string; slug: string };
  invoice: CateringOrderInvoice | null;
};

interface CalendarDayCellProps {
  date: Date;
  orders: OrderWithMerchant[];
  isCurrentMonth: boolean;
  isToday: boolean;
  defaultMerchantId?: string;
}

const STATUS_DOT_COLORS = {
  draft: "bg-gray-400",
  sent: "bg-blue-500",
  paid: "bg-green-500",
  completed: "bg-emerald-500",
  cancelled: "bg-red-500",
} as const;

export function CalendarDayCell({
  date,
  orders,
  isCurrentMonth,
  isToday,
  defaultMerchantId,
}: CalendarDayCellProps) {
  const dateStr = format(date, "yyyy-MM-dd");
  const hasOrders = orders.length > 0;

  return (
    <div
      className={`min-h-[120px] border-b border-r border-gray-200 p-1 ${
        isCurrentMonth ? "bg-white" : "bg-gray-50"
      }`}
    >
      {/* Date header */}
      <div className="mb-1 flex items-center justify-between">
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full text-sm ${
            isToday
              ? "bg-blue-600 font-semibold text-white"
              : isCurrentMonth
                ? "text-gray-900"
                : "text-gray-400"
          }`}
        >
          {date.getDate()}
        </span>
        {orders.length > 1 && (
          <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">
            {orders.length}
          </span>
        )}
      </div>

      {/* Orders list */}
      <div className="space-y-1">
        {orders.slice(0, 3).map((order) => (
          <Link
            key={order.id}
            href={`/dashboard/catering/orders/${order.id}`}
            className="block rounded px-1 py-0.5 text-xs hover:bg-gray-100"
          >
            <div className="flex items-center gap-1">
              <span
                className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                  STATUS_DOT_COLORS[order.status as keyof typeof STATUS_DOT_COLORS] || "bg-gray-400"
                }`}
              />
              <span className="truncate font-medium text-gray-700">
                {order.eventTime}
              </span>
            </div>
            <div className="truncate text-gray-500">
              {formatCustomerName(order.customerFirstName, order.customerLastName)}
            </div>
          </Link>
        ))}
        {orders.length > 3 && (
          <div className="px-1 text-xs text-gray-400">
            +{orders.length - 3} more
          </div>
        )}
      </div>

      {/* Empty state - click to create */}
      {!hasOrders && isCurrentMonth && (
        <Link
          href={`/dashboard/catering/orders/new?merchantId=${defaultMerchantId}&eventDate=${dateStr}`}
          className="flex h-[80px] items-center justify-center rounded text-gray-300 hover:bg-gray-50 hover:text-gray-400"
        >
          <Plus className="h-5 w-5" />
        </Link>
      )}
    </div>
  );
}
