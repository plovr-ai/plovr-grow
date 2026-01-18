"use client";

import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

interface LocationFilterProps {
  merchants: Array<{ id: string; name: string }>;
  value: string;
  onChange: (merchantId: string) => void;
}

export function LocationFilter({
  merchants,
  value,
  onChange,
}: LocationFilterProps) {
  // Only render if multiple merchants exist
  if (merchants.length <= 1) return null;

  return (
    <div className="w-full sm:w-[200px]">
      <Label htmlFor="location-filter" className="mb-2 block">Location</Label>
      <Select
        id="location-filter"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="all">All Locations</option>
        {merchants.map((merchant) => (
          <option key={merchant.id} value={merchant.id}>
            {merchant.name}
          </option>
        ))}
      </Select>
    </div>
  );
}
