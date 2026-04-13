import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { PlaceSearch } from "../PlaceSearch";

// --- Google Maps mock infrastructure ---

let eventHandlers: Record<string, ((event: unknown) => void)>;

function createMockPlaceAutocompleteElement() {
  const el = document.createElement("div");
  const originalAddEventListener = el.addEventListener.bind(el);
  el.addEventListener = vi.fn((event: string, handler: unknown) => {
    if (event === "gmp-placeselect" || event === "gmp-select") {
      eventHandlers[event] = handler as (event: unknown) => void;
    }
    originalAddEventListener(event, handler as EventListener);
  });
  return el;
}

function setupGoogleMapsGlobal({
  preloaded = false,
}: { preloaded?: boolean } = {}) {
  const mockElement = createMockPlaceAutocompleteElement();
  const PlaceAutocompleteElement = vi.fn(function () {
    return mockElement;
  });

  const googleMaps = {
    maps: {
      importLibrary: vi.fn().mockResolvedValue({ PlaceAutocompleteElement }),
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
    eventHandlers = {};
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

      Object.defineProperty(window, "google", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const onSelect = vi.fn();
      render(<PlaceSearch onSelect={onSelect} />);

      const scriptCalls = createElementSpy.mock.results.filter(
        (r) => r.type === "return" && (r.value as HTMLElement).tagName === "SCRIPT"
      );
      expect(scriptCalls.length).toBeGreaterThan(0);

      const script = scriptCalls[scriptCalls.length - 1].value as HTMLScriptElement;
      expect(script.src).toContain("maps.googleapis.com/maps/api/js");
      expect(script.src).toContain("key=test-api-key");
      expect(script.async).toBe(true);

      Object.defineProperty(window, "google", {
        value: googleMaps,
        writable: true,
        configurable: true,
      });
      injectPlacesLibrary(PlaceAutocompleteElement);

      await act(async () => {
        script.onload?.(new Event("load"));
      });

      expect(script.src).toContain("libraries=places");
    });

    it("should skip script loading when Google Maps is already loaded", async () => {
      setupGoogleMapsGlobal({ preloaded: true });

      const createElementSpy = vi.spyOn(document, "createElement");
      const onSelect = vi.fn();

      await act(async () => {
        render(<PlaceSearch onSelect={onSelect} />);
      });

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

    it("should register both gmp-placeselect and gmp-select listeners", async () => {
      setupGoogleMapsGlobal({ preloaded: true });

      const onSelect = vi.fn();
      await act(async () => {
        render(<PlaceSearch onSelect={onSelect} />);
      });

      expect(eventHandlers["gmp-placeselect"]).toBeDefined();
      expect(eventHandlers["gmp-select"]).toBeDefined();
    });

    it("should call onSelect via gmp-placeselect (legacy v3.58)", async () => {
      setupGoogleMapsGlobal({ preloaded: true });

      const onSelect = vi.fn();
      await act(async () => {
        render(<PlaceSearch onSelect={onSelect} />);
      });

      const mockPlace = {
        id: "place-123",
        displayName: "Test Restaurant",
        formattedAddress: "456 Oak Ave, Los Angeles, CA",
        fetchFields: vi.fn().mockResolvedValue(undefined),
      };

      await act(async () => {
        await eventHandlers["gmp-placeselect"]!({ place: mockPlace });
      });

      expect(mockPlace.fetchFields).toHaveBeenCalledWith({
        fields: ["displayName", "formattedAddress"],
      });
      expect(onSelect).toHaveBeenCalledWith({
        placeId: "place-123",
        name: "Test Restaurant",
        address: "456 Oak Ave, Los Angeles, CA",
      });
    });

    it("should call onSelect via gmp-select (v3.59+)", async () => {
      setupGoogleMapsGlobal({ preloaded: true });

      const onSelect = vi.fn();
      await act(async () => {
        render(<PlaceSearch onSelect={onSelect} />);
      });

      const mockPlace = {
        id: "place-456",
        displayName: "New API Restaurant",
        formattedAddress: "789 Elm St, Pasadena, CA",
        fetchFields: vi.fn().mockResolvedValue(undefined),
      };

      await act(async () => {
        await eventHandlers["gmp-select"]!({
          placePrediction: { toPlace: () => mockPlace },
        });
      });

      expect(onSelect).toHaveBeenCalledWith({
        placeId: "place-456",
        name: "New API Restaurant",
        address: "789 Elm St, Pasadena, CA",
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
        await eventHandlers["gmp-placeselect"]!({ place: mockPlace });
      });

      expect(onSelect).not.toHaveBeenCalled();
    });

  });
});
