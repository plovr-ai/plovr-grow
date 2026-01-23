"use client";

import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface OrderFiltersProps {
  filters: {
    status: string;
    orderMode: string;
    salesChannel: string;
    dateFrom: string;
    dateTo: string;
  };
  onChange: (filters: Partial<OrderFiltersProps["filters"]>) => void;
}

export function OrderFilters({ filters, onChange }: OrderFiltersProps) {
  return (
    <div className="flex flex-wrap gap-4 items-end">
      {/* Status Filter */}
      <div className="w-full sm:w-[200px]">
        <Label htmlFor="status-filter" className="mb-2 block">Status</Label>
        <Select
          id="status-filter"
          value={filters.status}
          onChange={(e) => onChange({ status: e.target.value })}
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="preparing">Preparing</option>
          <option value="ready">Ready</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </Select>
      </div>

      {/* Order Type Filter */}
      <div className="w-full sm:w-[200px]">
        <Label htmlFor="mode-filter" className="mb-2 block">Order Type</Label>
        <Select
          id="mode-filter"
          value={filters.orderMode}
          onChange={(e) => onChange({ orderMode: e.target.value })}
        >
          <option value="all">All Types</option>
          <option value="pickup">Pickup</option>
          <option value="delivery">Delivery</option>
          <option value="dine_in">Dine In</option>
        </Select>
      </div>

      {/* Sales Channel Filter */}
      <div className="w-full sm:w-[200px]">
        <Label htmlFor="sales-channel-filter" className="mb-2 block">Sales Channel</Label>
        <Select
          id="sales-channel-filter"
          value={filters.salesChannel}
          onChange={(e) => onChange({ salesChannel: e.target.value })}
        >
          <option value="all">All Channels</option>
          <option value="online_order">Online Order</option>
          <option value="catering">Catering</option>
          <option value="giftcard">Gift Card</option>
        </Select>
      </div>

      {/* Date From Filter */}
      <div className="w-full sm:w-[200px]">
        <Label htmlFor="date-from-filter" className="mb-2 block">From Date</Label>
        <Input
          id="date-from-filter"
          type="date"
          value={filters.dateFrom}
          onChange={(e) => onChange({ dateFrom: e.target.value })}
          onClick={(e) => {
            e.preventDefault();
            e.currentTarget.showPicker?.();
          }}
          className="cursor-pointer select-none"
        />
      </div>

      {/* Date To Filter */}
      <div className="w-full sm:w-[200px]">
        <Label htmlFor="date-to-filter" className="mb-2 block">To Date</Label>
        <Input
          id="date-to-filter"
          type="date"
          value={filters.dateTo}
          onChange={(e) => onChange({ dateTo: e.target.value })}
          onClick={(e) => {
            e.preventDefault();
            e.currentTarget.showPicker?.();
          }}
          className="cursor-pointer select-none"
        />
      </div>
    </div>
  );
}
