"use client";

import { useRef, useEffect, useCallback } from "react";

interface PlaceResult {
  placeId: string;
  name: string;
  address: string;
}

interface PlaceSearchProps {
  onSelect: (place: PlaceResult) => void;
}

function loadGoogleMapsScript(): Promise<void> {
  if (typeof window.google?.maps?.importLibrary === "function")
    return Promise.resolve();

  return new Promise((resolve) => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&loading=async`;
    script.async = true;
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
}

export function PlaceSearch({ onSelect }: PlaceSearchProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const elementRef = useRef<google.maps.places.PlaceAutocompleteElement | null>(
    null
  );

  const init = useCallback(async () => {
    if (!containerRef.current || elementRef.current) return;

    await loadGoogleMapsScript();
    await google.maps.importLibrary("places");

    const placeAutocomplete =
      new google.maps.places.PlaceAutocompleteElement({
        types: ["restaurant"],
        componentRestrictions: { country: "us" },
      });

    placeAutocomplete.addEventListener("gmp-placeselect", (async (
      event: google.maps.places.PlaceAutocompletePlaceSelectEvent
    ) => {
      const { place } = event;
      await place.fetchFields({
        fields: ["id", "displayName", "formattedAddress"],
      });
      if (place.id && place.displayName) {
        onSelect({
          placeId: place.id,
          name: place.displayName,
          address: place.formattedAddress ?? "",
        });
      }
    }) as unknown as EventListener);

    containerRef.current.appendChild(placeAutocomplete as unknown as Node);
    elementRef.current = placeAutocomplete;
  }, [onSelect]);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <div ref={containerRef} className="place-search-container" />
  );
}
