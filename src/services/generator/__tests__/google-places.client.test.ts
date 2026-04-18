import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createGooglePlacesClient, type GooglePlacesClient } from "../google-places.client";

describe("GooglePlacesClient", () => {
  let client: GooglePlacesClient;

  beforeEach(() => {
    client = createGooglePlacesClient("test-api-key");
  });

  it("fetches place details and maps fields correctly", async () => {
    const mockResponse = {
      displayName: { text: "Joe's Pizza" },
      formattedAddress: "123 Main St, New York, NY 10001, USA",
      addressComponents: [
        { types: ["locality"], longText: "New York" },
        { types: ["administrative_area_level_1"], shortText: "NY" },
        { types: ["postal_code"], longText: "10001" },
      ],
      nationalPhoneNumber: "(212) 555-0100",
      regularOpeningHours: {
        periods: [
          {
            open: { day: 1, hour: 11, minute: 0 },
            close: { day: 1, hour: 22, minute: 0 },
          },
        ],
      },
      photos: [{ name: "places/abc/photos/photo1" }],
      reviews: [
        {
          authorAttribution: { displayName: "John" },
          rating: 5,
          text: { text: "Great pizza!" },
          relativePublishTimeDescription: "a month ago",
        },
      ],
      websiteUri: "https://joespizza.com",
      googleMapsUri: "https://maps.google.com/place/abc",
    };

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const result = await client.getPlaceDetails("ChIJ_test123");

    expect(result.name).toBe("Joe's Pizza");
    expect(result.address).toBe("123 Main St, New York, NY 10001, USA");
    expect(result.city).toBe("New York");
    expect(result.state).toBe("NY");
    expect(result.zipCode).toBe("10001");
    expect(result.phone).toBe("(212) 555-0100");
    expect(result.websiteUrl).toBe("https://joespizza.com");
    expect(result.googleMapsUrl).toBe("https://maps.google.com/place/abc");
    expect(result.reviews).toHaveLength(1);
    expect(result.reviews[0].author).toBe("John");
    expect(result.reviews[0].rating).toBe(5);
    expect(result.photoReferences).toHaveLength(1);

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("https://places.googleapis.com/v1/places/ChIJ_test123"),
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Goog-Api-Key": "test-api-key",
        }),
      })
    );

    vi.unstubAllGlobals();
  });

  it("throws on API error response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: () => Promise.resolve("Invalid place ID"),
      })
    );

    await expect(client.getPlaceDetails("invalid")).rejects.toThrow(
      "Google Places API error"
    );

    vi.unstubAllGlobals();
  });

  it("handles missing optional fields gracefully", async () => {
    const mockResponse = {
      displayName: { text: "Minimal Place" },
      formattedAddress: "456 Oak Ave",
      addressComponents: [],
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })
    );

    const result = await client.getPlaceDetails("ChIJ_minimal");

    expect(result.name).toBe("Minimal Place");
    expect(result.city).toBe("");
    expect(result.state).toBe("");
    expect(result.zipCode).toBe("");
    expect(result.phone).toBeNull();
    expect(result.reviews).toEqual([]);
    expect(result.photoReferences).toEqual([]);
    expect(result.businessHours).toEqual({});

    vi.unstubAllGlobals();
  });

  it("handles opening hours without close time (defaults to 23:59)", async () => {
    const mockResponse = {
      displayName: { text: "24h Place" },
      formattedAddress: "789 Pine St",
      addressComponents: [],
      regularOpeningHours: {
        periods: [
          { open: { day: 1, hour: 0, minute: 0 } }, // no close = open 24h
        ],
      },
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })
    );

    const result = await client.getPlaceDetails("ChIJ_24h");

    expect(result.businessHours.monday).toEqual({
      open: "00:00",
      close: "23:59",
      closed: false,
    });

    vi.unstubAllGlobals();
  });

  it("handles missing displayName text", async () => {
    const mockResponse = {
      formattedAddress: "123 St",
      addressComponents: [],
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })
    );

    const result = await client.getPlaceDetails("ChIJ_noname");

    expect(result.name).toBe("");
    expect(result.websiteUrl).toBeNull();
    expect(result.googleMapsUrl).toBeNull();

    vi.unstubAllGlobals();
  });

  it("handles reviews with missing optional fields", async () => {
    const mockResponse = {
      displayName: { text: "Review Place" },
      formattedAddress: "456 St",
      addressComponents: [],
      reviews: [
        { rating: 3 }, // no authorAttribution, no text, no relativePublishTimeDescription
      ],
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })
    );

    const result = await client.getPlaceDetails("ChIJ_reviews");

    expect(result.reviews).toHaveLength(1);
    expect(result.reviews[0].author).toBe("Anonymous");
    expect(result.reviews[0].text).toBe("");
    expect(result.reviews[0].relativeTime).toBe("");

    vi.unstubAllGlobals();
  });

  it("handles opening hours with invalid day index", async () => {
    const mockResponse = {
      displayName: { text: "Bad Day" },
      formattedAddress: "999 St",
      addressComponents: [],
      regularOpeningHours: {
        periods: [
          { open: { day: 99, hour: 10, minute: 0 }, close: { day: 99, hour: 22, minute: 0 } },
        ],
      },
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })
    );

    const result = await client.getPlaceDetails("ChIJ_badday");

    expect(result.businessHours).toEqual({});

    vi.unstubAllGlobals();
  });

  it("handles address component with short text variant", async () => {
    const mockResponse = {
      displayName: { text: "State Place" },
      formattedAddress: "789 St",
      addressComponents: [
        { types: ["administrative_area_level_1"], shortText: "CA", longText: "California" },
        { types: ["locality"], longText: "Los Angeles" },
        { types: ["postal_code"], longText: "90001" },
      ],
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })
    );

    const result = await client.getPlaceDetails("ChIJ_state");

    expect(result.state).toBe("CA");
    expect(result.city).toBe("Los Angeles");

    vi.unstubAllGlobals();
  });

  it("handles completely missing addressComponents and formattedAddress", async () => {
    const mockResponse = {
      displayName: { text: "Bare Minimum" },
      // no formattedAddress
      // no addressComponents
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })
    );

    const result = await client.getPlaceDetails("ChIJ_bare");

    expect(result.address).toBe("");
    expect(result.city).toBe("");
    expect(result.state).toBe("");
    expect(result.zipCode).toBe("");

    vi.unstubAllGlobals();
  });

  it("uses proxy dispatcher when proxy env var is set and undici is available", async () => {
    // Set proxy env var
    process.env.https_proxy = "http://proxy.example.com:8080";

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        displayName: { text: "Proxy Test" },
        formattedAddress: "123 St",
        addressComponents: [],
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const freshClient = createGooglePlacesClient("test-key");
    const result = await freshClient.getPlaceDetails("ChIJ_proxy");
    expect(result.name).toBe("Proxy Test");
    // fetch called with dispatcher option when proxy is configured
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        dispatcher: expect.anything(),
      })
    );

    delete process.env.https_proxy;
    vi.unstubAllGlobals();
  });

  it("parses primaryType and types from API response", async () => {
    const mockResponse = {
      displayName: { text: "Test Restaurant" },
      formattedAddress: "123 Main St",
      addressComponents: [
        { types: ["locality"], longText: "New York" },
        { types: ["administrative_area_level_1"], shortText: "NY" },
        { types: ["postal_code"], longText: "10001" },
      ],
      primaryType: "italian_restaurant",
      types: ["italian_restaurant", "restaurant", "food", "establishment"],
      nationalPhoneNumber: "(212) 555-0100",
      photos: [],
      reviews: [],
    };

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    }));

    const result = await client.getPlaceDetails("test-place-id");
    expect(result.primaryType).toBe("italian_restaurant");
    expect(result.types).toEqual(["italian_restaurant", "restaurant", "food", "establishment"]);

    vi.unstubAllGlobals();
  });

  it("handles missing primaryType and types gracefully", async () => {
    const mockResponse = {
      displayName: { text: "Test" },
      formattedAddress: "123 Main St",
      addressComponents: [],
      photos: [],
      reviews: [],
    };

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    }));

    const result = await client.getPlaceDetails("test-place-id");
    expect(result.primaryType).toBeUndefined();
    expect(result.types).toBeUndefined();
    vi.unstubAllGlobals();
  });

  it("handles address components with null longText", async () => {
    const mockResponse = {
      displayName: { text: "Null Text" },
      formattedAddress: "123 St",
      addressComponents: [
        { types: ["locality"], longText: null },
        { types: ["administrative_area_level_1"], shortText: null },
        { types: ["postal_code"], longText: null },
      ],
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })
    );

    const result = await client.getPlaceDetails("ChIJ_nulltext");

    expect(result.city).toBe("");
    expect(result.state).toBe("");
    expect(result.zipCode).toBe("");

    vi.unstubAllGlobals();
  });

  it("converts opening hours to businessHours format", async () => {
    const mockResponse = {
      displayName: { text: "Hours Test" },
      formattedAddress: "789 Pine St",
      addressComponents: [],
      regularOpeningHours: {
        periods: [
          { open: { day: 0, hour: 10, minute: 0 }, close: { day: 0, hour: 21, minute: 30 } },
          { open: { day: 1, hour: 11, minute: 0 }, close: { day: 1, hour: 22, minute: 0 } },
          { open: { day: 2, hour: 11, minute: 0 }, close: { day: 2, hour: 22, minute: 0 } },
          { open: { day: 3, hour: 11, minute: 0 }, close: { day: 3, hour: 22, minute: 0 } },
          { open: { day: 4, hour: 11, minute: 0 }, close: { day: 4, hour: 22, minute: 0 } },
          { open: { day: 5, hour: 11, minute: 0 }, close: { day: 5, hour: 23, minute: 0 } },
          { open: { day: 6, hour: 10, minute: 0 }, close: { day: 6, hour: 23, minute: 0 } },
        ],
      },
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })
    );

    const result = await client.getPlaceDetails("ChIJ_hours");

    expect(result.businessHours).toEqual({
      sunday: { open: "10:00", close: "21:30", closed: false },
      monday: { open: "11:00", close: "22:00", closed: false },
      tuesday: { open: "11:00", close: "22:00", closed: false },
      wednesday: { open: "11:00", close: "22:00", closed: false },
      thursday: { open: "11:00", close: "22:00", closed: false },
      friday: { open: "11:00", close: "23:00", closed: false },
      saturday: { open: "10:00", close: "23:00", closed: false },
    });

    vi.unstubAllGlobals();
  });
});
