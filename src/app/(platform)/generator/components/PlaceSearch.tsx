"use client";

import { useRef, useEffect, useState, useCallback } from "react";

interface PlaceResult {
  placeId: string;
  name: string;
  address: string;
}

interface PlaceSearchProps {
  onSelect: (place: PlaceResult) => void;
}

export function PlaceSearch({ onSelect }: PlaceSearchProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const elementRef = useRef<google.maps.places.PlaceAutocompleteElement | null>(
    null
  );
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (window.google?.maps?.places?.PlaceAutocompleteElement) {
      queueMicrotask(() => setLoaded(true));
      return;
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
    script.async = true;
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);
  }, []);

  const initAutocomplete = useCallback(() => {
    if (!containerRef.current || !window.google?.maps?.places) return;
    if (elementRef.current) return;

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
    if (loaded) initAutocomplete();
  }, [loaded, initAutocomplete]);

  return (
    <div
      ref={containerRef}
      className="[&_input]:w-full [&_input]:text-lg [&_input]:px-4 [&_input]:py-3 [&_input]:border [&_input]:border-gray-300 [&_input]:rounded-lg [&_input]:focus:outline-none [&_input]:focus:ring-2 [&_input]:focus:ring-blue-500 [&_input]:focus:border-transparent"
    />
  );
}
