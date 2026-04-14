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

/**
 * Patch attachShadow to force light theme styles into the Google Places
 * autocomplete Web Component. Its Shadow DOM is closed, so external CSS
 * and custom properties cannot reach it.
 */
let shadowPatched = false;
function patchShadowDomForLightTheme() {
  if (shadowPatched) return;
  shadowPatched = true;

  const original = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function (init) {
    const shadow = original.call(this, { ...init, mode: "open" });

    if (this.localName === "gmp-place-autocomplete") {
      const style = document.createElement("style");
      style.textContent = `
        :host, *, ::before, ::after {
          color-scheme: light !important;
        }
        :host {
          --gmp-mat-color-surface: #ffffff !important;
          --gmp-mat-color-on-surface: #1f2937 !important;
          --gmp-mat-color-on-surface-variant: #6b7280 !important;
          --gmp-mat-color-outline: #d1d5db !important;
        }
        input {
          background-color: #ffffff !important;
          color: #1f2937 !important;
          border: 1px solid #d1d5db !important;
          border-radius: 0.5rem !important;
          padding: 0.75rem 1rem !important;
          font-size: 1.125rem !important;
          width: 100% !important;
          outline: none !important;
          box-sizing: border-box !important;
        }
        input:focus {
          border-color: #ffbf00 !important;
          box-shadow: 0 0 0 1px #ffbf00 !important;
        }
      `;
      shadow.appendChild(style);
    }

    return shadow;
  };
}

export function PlaceSearch({ onSelect }: PlaceSearchProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const elementRef = useRef<google.maps.places.PlaceAutocompleteElement | null>(
    null
  );

  const initAutocomplete = useCallback(async () => {
    if (!containerRef.current || elementRef.current) return;

    // Patch Shadow DOM before loading Google Maps
    patchShadowDomForLightTheme();

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
      style={{ colorScheme: "light" }}
      className="w-full"
    />
  );
}
