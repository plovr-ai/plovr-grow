import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { PlaceSearch } from "../PlaceSearch";

// --- Google Maps mock infrastructure ---

let placeSelectHandler: ((event: unknown) => void) | null = null;

function createMockPlaceAutocompleteElement() {
  // Use a real DOM element so appendChild works in jsdom
  const el = document.createElement("div");
  const originalAddEventListener = el.addEventListener.bind(el);
  el.addEventListener = vi.fn((event: string, handler: unknown) => {
    if (event === "gmp-placeselect") {
      placeSelectHandler = handler as (event: unknown) => void;
    }
    originalAddEventListener(event, handler as EventListener);
  });
  return el;
}

function setupGoogleMapsGlobal({
  preloaded = false,
}: { preloaded?: boolean } = {}) {
  const mockElement = createMockPlaceAutocompleteElement();
  // Return the DOM element from the constructor so it can be appended
  const PlaceAutocompleteElement = vi.fn(function () {
    return mockElement;
  });

  const googleMaps = {
    maps: {
      importLibrary: vi.fn().mockResolvedValue(undefined),
      ...(preloaded
        ? {
            places: { PlaceAutocompleteElement },
          }
        : {}),
    },
  };

  Object.defineProperty(window, "google", {
    value: googleMaps,
    writable: true,
    configurable: true,
  });

  return { mockElement, PlaceAutocompleteElement, googleMaps };
}

function injectPlacesLibrary(
  PlaceAutocompleteElement: ReturnType<typeof vi.fn>
) {
  (window.google as unknown as Record<string, unknown>).maps = {
    ...(window.google?.maps ?? {}),
    places: { PlaceAutocompleteElement },
  };
}

describe("PlaceSearch", () => {
  let originalGoogle: typeof globalThis.google;
  const ENV_KEY = "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY";

  beforeEach(() => {
    originalGoogle = window.google;
    placeSelectHandler = null;
    vi.stubEnv(ENV_KEY, "test-api-key");
  });

  afterEach(() => {
    Object.defineProperty(window, "google", {
      value: originalGoogle,
      writable: true,
      configurable: true,
    });
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    document.head.querySelectorAll("script").forEach((s) => s.remove());
  });

  describe("script loading", () => {
    it("should load Google Maps script with correct URL including places library", async () => {
      const createElementSpy = vi.spyOn(document, "createElement");

      const { PlaceAutocompleteElement, googleMaps } = setupGoogleMapsGlobal();

      // Remove google from window initially so it triggers script loading
      Object.defineProperty(window, "google", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const onSelect = vi.fn();
      render(<PlaceSearch onSelect={onSelect} />);

      // Find the script element that was created
      const scriptCalls = createElementSpy.mock.results.filter(
        (r) => r.type === "return" && (r.value as HTMLElement).tagName === "SCRIPT"
      );
      expect(scriptCalls.length).toBeGreaterThan(0);

      const script = scriptCalls[scriptCalls.length - 1].value as HTMLScriptElement;
      expect(script.src).toContain("maps.googleapis.com/maps/api/js");
      expect(script.src).toContain("key=test-api-key");
      expect(script.async).toBe(true);

      // Simulate script load — set google global, then fire onload
      Object.defineProperty(window, "google", {
        value: googleMaps,
        writable: true,
        configurable: true,
      });
      injectPlacesLibrary(PlaceAutocompleteElement);

      await act(async () => {
        script.onload?.(new Event("load"));
      });

      // Script URL should include libraries=places
      expect(script.src).toContain("libraries=places");
    });

    it("should skip script loading when Google Maps is already loaded", async () => {
      setupGoogleMapsGlobal({ preloaded: true });

      const createElementSpy = vi.spyOn(document, "createElement");
      const onSelect = vi.fn();

      await act(async () => {
        render(<PlaceSearch onSelect={onSelect} />);
      });

      // Should not have created a script element for Google Maps
      const scriptCalls = createElementSpy.mock.results.filter(
        (r) =>
          r.type === "return" &&
          (r.value as HTMLScriptElement).tagName === "SCRIPT" &&
          (r.value as HTMLScriptElement).src?.includes("maps.googleapis.com")
      );
      expect(scriptCalls).toHaveLength(0);
    });
  });

  describe("autocomplete element", () => {
    it("should create PlaceAutocompleteElement after library loads", async () => {
      const { PlaceAutocompleteElement } = setupGoogleMapsGlobal({
        preloaded: true,
      });

      const onSelect = vi.fn();
      await act(async () => {
        render(<PlaceSearch onSelect={onSelect} />);
      });

      expect(PlaceAutocompleteElement).toHaveBeenCalled();
    });

    it("should call onSelect with place data when a place is selected", async () => {
      setupGoogleMapsGlobal({ preloaded: true });

      const onSelect = vi.fn();
      await act(async () => {
        render(<PlaceSearch onSelect={onSelect} />);
      });

      expect(placeSelectHandler).not.toBeNull();

      // Simulate place selection
      const mockPlace = {
        id: "place-123",
        displayName: "Test Restaurant",
        formattedAddress: "456 Oak Ave, Los Angeles, CA",
        fetchFields: vi.fn().mockResolvedValue(undefined),
      };

      await act(async () => {
        await placeSelectHandler!({ place: mockPlace });
      });

      expect(mockPlace.fetchFields).toHaveBeenCalledWith({
        fields: ["id", "displayName", "formattedAddress"],
      });
      expect(onSelect).toHaveBeenCalledWith({
        placeId: "place-123",
        name: "Test Restaurant",
        address: "456 Oak Ave, Los Angeles, CA",
      });
    });

    it("should not call onSelect when place data is incomplete", async () => {
      setupGoogleMapsGlobal({ preloaded: true });

      const onSelect = vi.fn();
      await act(async () => {
        render(<PlaceSearch onSelect={onSelect} />);
      });

      const mockPlace = {
        id: null,
        displayName: null,
        formattedAddress: null,
        fetchFields: vi.fn().mockResolvedValue(undefined),
      };

      await act(async () => {
        await placeSelectHandler!({ place: mockPlace });
      });

      expect(onSelect).not.toHaveBeenCalled();
    });
  });
});
