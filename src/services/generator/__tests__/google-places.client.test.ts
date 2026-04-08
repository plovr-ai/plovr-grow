import { describe, it, expect, vi, beforeEach } from "vitest";
import { GooglePlacesClient, type PlaceDetails } from "../google-places.client";

describe("GooglePlacesClient", () => {
  let client: GooglePlacesClient;

  beforeEach(() => {
    client = new GooglePlacesClient("test-api-key");
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
