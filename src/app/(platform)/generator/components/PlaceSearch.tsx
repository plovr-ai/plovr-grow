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
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (window.google?.maps?.places) {
      setLoaded(true);
      return;
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);
  }, []);

  const initAutocomplete = useCallback(() => {
    if (!inputRef.current || !window.google?.maps?.places) return;
    if (autocompleteRef.current) return;

    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      types: ["restaurant"],
      componentRestrictions: { country: "us" },
      fields: ["place_id", "name", "formatted_address"],
    });

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (place.place_id && place.name) {
        onSelect({
          placeId: place.place_id,
          name: place.name,
          address: place.formatted_address ?? "",
        });
      }
    });

    autocompleteRef.current = autocomplete;
  }, [onSelect]);

  useEffect(() => {
    if (loaded) initAutocomplete();
  }, [loaded, initAutocomplete]);

  return (
    <input
      ref={inputRef}
      type="text"
      placeholder="Search for your restaurant..."
      className="w-full text-lg px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    />
  );
}
