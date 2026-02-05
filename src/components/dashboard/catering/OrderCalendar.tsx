"use client";

import { useMemo } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  format,
  addMonths,
  subMonths,
} from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CalendarDayCell } from "./CalendarDayCell";
import type { CateringOrderData, CateringOrderInvoice } from "@/services/catering/catering-order.types";

type OrderWithMerchant = CateringOrderData & {
  merchant: { id: string; name: string; slug: string };
  invoice: CateringOrderInvoice | null;
};

interface OrderCalendarProps {
  orders: OrderWithMerchant[];
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  defaultMerchantId?: string;
  timezone?: string;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function OrderCalendar({
  orders,
  currentMonth,
  onMonthChange,
  defaultMerchantId,
  timezone = "America/New_York",
}: OrderCalendarProps) {
  // Get today in merchant's timezone
  const today = toZonedTime(new Date(), timezone);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  // Group orders by date
  const ordersByDate = useMemo(() => {
    const grouped = new Map<string, OrderWithMerchant[]>();

    orders.forEach((order) => {
      const dateKey = format(new Date(order.eventDate), "yyyy-MM-dd");
      const existing = grouped.get(dateKey) || [];
      grouped.set(dateKey, [...existing, order]);
    });

    // Sort orders within each day by eventTime
    grouped.forEach((dayOrders, key) => {
      grouped.set(
        key,
        dayOrders.sort((a, b) => a.eventTime.localeCompare(b.eventTime))
      );
    });

    return grouped;
  }, [orders]);

  const handlePrevMonth = () => {
    onMonthChange(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    onMonthChange(addMonths(currentMonth, 1));
  };

  const handleToday = () => {
    onMonthChange(toZonedTime(new Date(), timezone));
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      {/* Calendar header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {format(currentMonth, "MMMM yyyy")}
          </h3>
          <Button variant="outline" size="sm" onClick={handleToday}>
            Today
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={handlePrevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-gray-200">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="border-r border-gray-200 py-2 text-center text-xs font-medium uppercase tracking-wider text-gray-500 last:border-r-0"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {calendarDays.map((date, index) => {
          const dateKey = format(date, "yyyy-MM-dd");
          const dayOrders = ordersByDate.get(dateKey) || [];

          return (
            <CalendarDayCell
              key={index}
              date={date}
              orders={dayOrders}
              isCurrentMonth={isSameMonth(date, currentMonth)}
              isToday={isSameDay(date, today)}
              defaultMerchantId={defaultMerchantId}
            />
          );
        })}
      </div>
    </div>
  );
}
