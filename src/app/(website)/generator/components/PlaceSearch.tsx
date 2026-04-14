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
  // Already fully loaded
  if (window.google?.maps?.places?.PlaceAutocompleteElement) {
    return Promise.resolve();
  }

  // Script already in DOM — wait for it
  const existing = document.querySelector<HTMLScriptElement>(
    'script[src*="maps.googleapis.com/maps/api/js"]'
  );
  if (existing) {
    return new Promise<void>((resolve) => {
      if (window.google?.maps?.places?.PlaceAutocompleteElement) {
        resolve();
      } else {
        existing.addEventListener("load", () => resolve());
        // If already loaded but places not ready, resolve anyway
        // (libraries=places in the URL guarantees it loads with the script)
        if (existing.dataset.loaded === "true") resolve();
      }
    });
  }

  // Load fresh
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const script = document.createElement("script");
  script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
  script.async = true;
  document.head.appendChild(script);

  return new Promise<void>((resolve, reject) => {
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error("Google Maps script failed to load"));
  });
}

export function PlaceSearch({ onSelect }: PlaceSearchProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const elementRef = useRef<google.maps.places.PlaceAutocompleteElement | null>(
    null
  );

  const initAutocomplete = useCallback(async () => {
    if (!containerRef.current || elementRef.current) return;

    try {
      await loadGoogleMapsScript();
    } catch (err) {
      console.error("[PlaceSearch] failed to load Google Maps:", err);
      return;
    }

    if (!containerRef.current || elementRef.current) return;
    if (!window.google?.maps?.places?.PlaceAutocompleteElement) {
      console.error("[PlaceSearch] PlaceAutocompleteElement not available");
      return;
    }

    const placeAutocomplete =
      new google.maps.places.PlaceAutocompleteElement({
        types: ["restaurant"],
        componentRestrictions: { country: "us" },
      });

    async function handlePlace(place: google.maps.places.Place) {
      try {
        await place.fetchFields({
          fields: ["displayName", "formattedAddress"],
        });
        const placeId = place.id;
        const name = place.displayName ?? "";
        const address = place.formattedAddress ?? "";
        if (placeId && name) {
          onSelect({ placeId, name, address });
        }
      } catch (err) {
        console.error("[PlaceSearch] fetchFields failed:", err);
      }
    }

    // v3.58 and below
    placeAutocomplete.addEventListener("gmp-placeselect", ((event: unknown) => {
      const e = event as { place?: google.maps.places.Place };
      if (e.place) handlePlace(e.place);
    }) as EventListener);

    // v3.59+ renamed the event to gmp-select
    placeAutocomplete.addEventListener("gmp-select", ((event: unknown) => {
      const e = event as {
        placePrediction?: { toPlace: () => google.maps.places.Place };
      };
      if (e.placePrediction) handlePlace(e.placePrediction.toPlace());
    }) as EventListener);

    containerRef.current.appendChild(placeAutocomplete as unknown as Node);
    elementRef.current = placeAutocomplete;
  }, [onSelect]);

  useEffect(() => {
    initAutocomplete();
  }, [initAutocomplete]);

  return (
    <div
      ref={containerRef}
      style={{
        colorScheme: "light",
        // Google Places UI Kit CSS custom properties — force light mode
        "--gmp-mat-color-surface": "#ffffff",
        "--gmp-mat-color-on-surface": "#1f2937",
        "--gmp-mat-color-on-surface-variant": "#6b7280",
        "--gmp-mat-color-primary": "#ffbf00",
        "--gmp-mat-color-outline": "#d1d5db",
      } as React.CSSProperties}
      className="border border-gray-300 rounded-lg bg-white [&_input]:w-full [&_input]:bg-white [&_input]:text-gray-900 [&_input]:text-lg [&_input]:px-4 [&_input]:py-3 [&_input]:border-none [&_input]:focus:outline-none [&_input]:focus:ring-0"
    />
  );
}
