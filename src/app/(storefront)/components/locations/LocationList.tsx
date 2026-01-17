"use client";

import { LocationCard } from "./LocationCard";
import type { MerchantStatus } from "@/types/merchant";

interface LocationItem {
  id: string;
  slug: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  status: MerchantStatus;
}

interface LocationListProps {
  locations: LocationItem[];
  currentMerchantId: string;
}

export function LocationList({ locations, currentMerchantId }: LocationListProps) {
  if (locations.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No locations found.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {locations.map((location) => (
        <LocationCard
          key={location.id}
          id={location.id}
          slug={location.slug}
          name={location.name}
          address={location.address}
          city={location.city}
          state={location.state}
          status={location.status}
          isCurrentLocation={location.id === currentMerchantId}
        />
      ))}
    </div>
  );
}
