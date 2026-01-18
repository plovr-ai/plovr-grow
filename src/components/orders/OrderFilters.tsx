"use client";

import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface OrderFiltersProps {
  filters: {
    status: string;
    orderType: string;
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
        <Label htmlFor="type-filter" className="mb-2 block">Order Type</Label>
        <Select
          id="type-filter"
          value={filters.orderType}
          onChange={(e) => onChange({ orderType: e.target.value })}
        >
          <option value="all">All Types</option>
          <option value="pickup">Pickup</option>
          <option value="delivery">Delivery</option>
          <option value="dine_in">Dine In</option>
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
