import { describe, it, expect, vi, beforeEach } from "vitest";
import { GoogleBusinessScraper } from "../google-business.scraper";
import { WebsiteScraper } from "../website.scraper";
import { UberEatsScraper } from "../ubereats.scraper";
import { DoorDashScraper } from "../doordash.scraper";
import { getScraper, getAllScrapers, detectSourceType } from "../index";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makeResponse(body: string, status = 200, headers: Record<string, string> = {}): Response {
  let parsed: unknown = {};
  try { parsed = JSON.parse(body); } catch { /* not JSON */ }
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    headers: new Headers(headers),
    text: vi.fn().mockResolvedValue(body),
    json: vi.fn().mockResolvedValue(parsed),
  } as unknown as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ==================== GoogleBusinessScraper ====================

describe("GoogleBusinessScraper", () => {
  let scraper: GoogleBusinessScraper;

  beforeEach(() => {
    scraper = new GoogleBusinessScraper();
  });

  describe("getName()", () => {
    it("should return google_business", () => {
      expect(scraper.getName()).toBe("google_business");
    });
  });

  describe("canHandle()", () => {
    it("should handle google.com/maps/place/ URLs", () => {
      expect(scraper.canHandle("https://google.com/maps/place/Test")).toBe(true);
    });

    it("should handle business.google.com URLs", () => {
      expect(scraper.canHandle("https://business.google.com/test")).toBe(true);
    });

    it("should handle maps.google.com URLs", () => {
      expect(scraper.canHandle("https://maps.google.com/test")).toBe(true);
    });

    it("should handle g.co/kgs/ URLs", () => {
      expect(scraper.canHandle("https://g.co/kgs/abc123")).toBe(true);
    });

    it("should not handle non-Google URLs", () => {
      expect(scraper.canHandle("https://example.com")).toBe(false);
    });
  });

  describe("scrape()", () => {
    it("should return success with content for valid response", async () => {
      const html = `
        <html>
          <head><title>Test Restaurant</title></head>
          <body><p>Great food</p></body>
        </html>
      `;
      mockFetch.mockResolvedValueOnce(makeResponse(html));

      const result = await scraper.scrape("https://google.com/maps/place/Test");

      expect(result.success).toBe(true);
      expect(result.content?.url).toBe("https://google.com/maps/place/Test");
      expect(result.content?.metadata?.title).toBe("Test Restaurant");
      expect(result.content?.scrapedAt).toBeDefined();
    });

    it("should return error for non-OK response", async () => {
      mockFetch.mockResolvedValueOnce(makeResponse("", 500));

      const result = await scraper.scrape("https://google.com/maps/place/Test");

      expect(result.success).toBe(false);
      expect(result.error).toContain("HTTP 500");
    });

    it("should follow redirects (3xx)", async () => {
      const redirectResponse = {
        ok: false,
        status: 301,
        statusText: "Moved",
        headers: new Headers({ location: "https://google.com/maps/place/Final" }),
        text: vi.fn().mockResolvedValue(""),
      } as unknown as Response;

      const finalHtml = "<html><head><title>Final</title></head><body>Content</body></html>";

      mockFetch
        .mockResolvedValueOnce(redirectResponse)
        .mockResolvedValueOnce(makeResponse(finalHtml));

      const result = await scraper.scrape("https://google.com/maps/place/Test");

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should return error for 3xx without location header", async () => {
      const redirectResponse = {
        ok: false,
        status: 302,
        statusText: "Found",
        headers: new Headers(),
        text: vi.fn().mockResolvedValue(""),
      } as unknown as Response;

      mockFetch.mockResolvedValueOnce(redirectResponse);

      const result = await scraper.scrape("https://google.com/maps/place/Test");

      expect(result.success).toBe(false);
      expect(result.error).toContain("HTTP 302");
    });

    it("should handle AbortError (timeout)", async () => {
      const abortError = new Error("Aborted");
      abortError.name = "AbortError";
      mockFetch.mockRejectedValueOnce(abortError);

      const result = await scraper.scrape("https://google.com/maps/place/Test");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Request timeout");
    });

    it("should handle generic errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network failure"));

      const result = await scraper.scrape("https://google.com/maps/place/Test");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network failure");
    });

    it("should handle non-Error throws", async () => {
      mockFetch.mockRejectedValueOnce("string error");

      const result = await scraper.scrape("https://google.com/maps/place/Test");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown error");
    });

    it("should extract embedded APP_INITIALIZATION_STATE data", async () => {
      const html = `
        <html><head><title>Test</title></head><body>
        <script>window.APP_INITIALIZATION_STATE = [1,2,3];</script>
        </body></html>
      `;
      mockFetch.mockResolvedValueOnce(makeResponse(html));

      const result = await scraper.scrape("https://google.com/maps/place/Test");

      expect(result.success).toBe(true);
      expect(result.content?.text).toContain("[EMBEDDED DATA]");
    });

    it("should extract og:title and og:description from meta tags", async () => {
      const html = `
        <html><head>
          <title>Test</title>
          <meta property="og:title" content="OG Restaurant Name" />
          <meta property="og:description" content="OG Description" />
        </head><body>Content</body></html>
      `;
      mockFetch.mockResolvedValueOnce(makeResponse(html));

      const result = await scraper.scrape("https://google.com/maps/place/Test");

      expect(result.success).toBe(true);
      expect(result.content?.text).toContain("[EMBEDDED DATA]");
    });

    it("should extract JSON-LD data for Restaurant type", async () => {
      const jsonLd = JSON.stringify({ "@type": "Restaurant", "name": "Test" });
      const html = `
        <html><head><title>Test</title>
        <script type="application/ld+json">${jsonLd}</script>
        </head><body>Content</body></html>
      `;
      mockFetch.mockResolvedValueOnce(makeResponse(html));

      const result = await scraper.scrape("https://google.com/maps/place/Test");

      expect(result.success).toBe(true);
      expect(result.content?.text).toContain("[JSON-LD DATA]");
    });

    it("should extract JSON-LD data for FoodEstablishment type", async () => {
      const jsonLd = JSON.stringify({ "@type": "FoodEstablishment", "name": "Test" });
      const html = `
        <html><head><title>Test</title>
        <script type="application/ld+json">${jsonLd}</script>
        </head><body>Content</body></html>
      `;
      mockFetch.mockResolvedValueOnce(makeResponse(html));

      const result = await scraper.scrape("https://google.com/maps/place/Test");

      expect(result.success).toBe(true);
      expect(result.content?.text).toContain("[JSON-LD DATA]");
    });

    it("should extract JSON-LD for type containing 'Restaurant'", async () => {
      const jsonLd = JSON.stringify({ "@type": "FastFoodRestaurant", "name": "Test" });
      const html = `
        <html><head><title>Test</title>
        <script type="application/ld+json">${jsonLd}</script>
        </head><body>Content</body></html>
      `;
      mockFetch.mockResolvedValueOnce(makeResponse(html));

      const result = await scraper.scrape("https://google.com/maps/place/Test");

      expect(result.success).toBe(true);
      expect(result.content?.text).toContain("[JSON-LD DATA]");
    });

    it("should skip invalid JSON-LD entries", async () => {
      const html = `
        <html><head><title>Test</title>
        <script type="application/ld+json">not valid json</script>
        </head><body>Content</body></html>
      `;
      mockFetch.mockResolvedValueOnce(makeResponse(html));

      const result = await scraper.scrape("https://google.com/maps/place/Test");

      expect(result.success).toBe(true);
      expect(result.content?.text).not.toContain("[JSON-LD DATA]");
    });

    it("should skip non-restaurant JSON-LD types", async () => {
      const jsonLd = JSON.stringify({ "@type": "WebSite", "name": "Test" });
      const html = `
        <html><head><title>Test</title>
        <script type="application/ld+json">${jsonLd}</script>
        </head><body>Content</body></html>
      `;
      mockFetch.mockResolvedValueOnce(makeResponse(html));

      const result = await scraper.scrape("https://google.com/maps/place/Test");

      expect(result.success).toBe(true);
      expect(result.content?.text).not.toContain("[JSON-LD DATA]");
    });

    it("should handle embedded data with invalid JSON gracefully", async () => {
      const html = `
        <html><head><title>Test</title></head><body>
        <script>window.APP_INITIALIZATION_STATE = [not valid json;</script>
        </body></html>
      `;
      mockFetch.mockResolvedValueOnce(makeResponse(html));

      const result = await scraper.scrape("https://google.com/maps/place/Test");

      // Should still succeed, just without embedded data
      expect(result.success).toBe(true);
    });
  });
});

// ==================== DoorDashScraper ====================

describe("DoorDashScraper", () => {
  let scraper: DoorDashScraper;

  beforeEach(() => {
    scraper = new DoorDashScraper();
  });

  describe("getName()", () => {
    it("should return doordash", () => {
      expect(scraper.getName()).toBe("doordash");
    });
  });

  describe("canHandle()", () => {
    it("should handle doordash.com/store/ URLs", () => {
      expect(scraper.canHandle("https://www.doordash.com/store/test-123")).toBe(true);
    });

    it("should not handle non-DoorDash URLs", () => {
      expect(scraper.canHandle("https://example.com")).toBe(false);
    });
  });

  describe("scrape()", () => {
    it("should return success with content", async () => {
      const html = "<html><head><title>DD Restaurant</title></head><body>Menu</body></html>";
      mockFetch.mockResolvedValueOnce(makeResponse(html));

      const result = await scraper.scrape("https://doordash.com/store/test");

      expect(result.success).toBe(true);
      expect(result.content?.metadata?.title).toBe("DD Restaurant");
    });

    it("should return error for non-OK response", async () => {
      mockFetch.mockResolvedValueOnce(makeResponse("", 404));

      const result = await scraper.scrape("https://doordash.com/store/test");

      expect(result.success).toBe(false);
      expect(result.error).toContain("HTTP 404");
    });

    it("should extract __NEXT_DATA__ JSON", async () => {
      const nextData = JSON.stringify({
        props: {
          pageProps: { store: { name: "Test Store" } },
        },
      });
      const html = `
        <html><head><title>Test</title></head><body>
        <script id="__NEXT_DATA__" type="application/json">${nextData}</script>
        </body></html>
      `;
      mockFetch.mockResolvedValueOnce(makeResponse(html));

      const result = await scraper.scrape("https://doordash.com/store/test");

      expect(result.success).toBe(true);
      expect(result.content?.text).toContain("[NEXT_DATA JSON]");
    });

    it("should handle invalid __NEXT_DATA__ JSON gracefully", async () => {
      const html = `
        <html><head><title>Test</title></head><body>
        <script id="__NEXT_DATA__" type="application/json">not json</script>
        </body></html>
      `;
      mockFetch.mockResolvedValueOnce(makeResponse(html));

      const result = await scraper.scrape("https://doordash.com/store/test");

      expect(result.success).toBe(true);
      expect(result.content?.text).not.toContain("[NEXT_DATA JSON]");
    });

    it("should extract JSON-LD for Restaurant type", async () => {
      const jsonLd = JSON.stringify({ "@type": "Restaurant", "name": "DD Restaurant" });
      const html = `
        <html><head><title>Test</title>
        <script type="application/ld+json">${jsonLd}</script>
        </head><body>Content</body></html>
      `;
      mockFetch.mockResolvedValueOnce(makeResponse(html));

      const result = await scraper.scrape("https://doordash.com/store/test");

      expect(result.success).toBe(true);
      expect(result.content?.text).toContain("[JSON-LD DATA]");
    });

    it("should extract JSON-LD for Menu type", async () => {
      const jsonLd = JSON.stringify({ "@type": "Menu", "name": "Main Menu" });
      const html = `
        <html><head><title>Test</title>
        <script type="application/ld+json">${jsonLd}</script>
        </head><body>Content</body></html>
      `;
      mockFetch.mockResolvedValueOnce(makeResponse(html));

      const result = await scraper.scrape("https://doordash.com/store/test");

      expect(result.success).toBe(true);
      expect(result.content?.text).toContain("[JSON-LD DATA]");
    });

    it("should handle AbortError (timeout)", async () => {
      const abortError = new Error("Aborted");
      abortError.name = "AbortError";
      mockFetch.mockRejectedValueOnce(abortError);

      const result = await scraper.scrape("https://doordash.com/store/test");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Request timeout");
    });

    it("should handle generic errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

      const result = await scraper.scrape("https://doordash.com/store/test");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Connection refused");
    });

    it("should handle non-Error throws", async () => {
      mockFetch.mockRejectedValueOnce(42);

      const result = await scraper.scrape("https://doordash.com/store/test");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown error");
    });

    it("should extract __NEXT_DATA__ without pageProps (fallback to full data)", async () => {
      const nextData = JSON.stringify({ someField: "value" });
      const html = `
        <html><head><title>Test</title></head><body>
        <script id="__NEXT_DATA__" type="application/json">${nextData}</script>
        </body></html>
      `;
      mockFetch.mockResolvedValueOnce(makeResponse(html));

      const result = await scraper.scrape("https://doordash.com/store/test");

      expect(result.success).toBe(true);
      expect(result.content?.text).toContain("[NEXT_DATA JSON]");
    });

    it("should extract JSON-LD for LocalBusiness type", async () => {
      const jsonLd = JSON.stringify({ "@type": "LocalBusiness", "name": "DD Local" });
      const html = `
        <html><head><title>Test</title>
        <script type="application/ld+json">${jsonLd}</script>
        </head><body>Content</body></html>
      `;
      mockFetch.mockResolvedValueOnce(makeResponse(html));

      const result = await scraper.scrape("https://doordash.com/store/test");

      expect(result.success).toBe(true);
      expect(result.content?.text).toContain("[JSON-LD DATA]");
    });
  });
});

// ==================== UberEatsScraper ====================

describe("UberEatsScraper", () => {
  let scraper: UberEatsScraper;

  beforeEach(() => {
    scraper = new UberEatsScraper();
  });

  describe("getName()", () => {
    it("should return ubereats", () => {
      expect(scraper.getName()).toBe("ubereats");
    });
  });

  describe("canHandle()", () => {
    it("should handle ubereats.com/store/ URLs", () => {
      expect(scraper.canHandle("https://www.ubereats.com/store/test-123")).toBe(true);
    });

    it("should not handle non-UberEats URLs", () => {
      expect(scraper.canHandle("https://example.com")).toBe(false);
    });
  });

  describe("scrape()", () => {
    it("should return success with content", async () => {
      const html = "<html><head><title>UE Restaurant</title></head><body>Menu</body></html>";
      mockFetch.mockResolvedValueOnce(makeResponse(html));

      const result = await scraper.scrape("https://ubereats.com/store/test");

      expect(result.success).toBe(true);
      expect(result.content?.metadata?.title).toBe("UE Restaurant");
    });

    it("should return error for non-OK response", async () => {
      mockFetch.mockResolvedValueOnce(makeResponse("", 403));

      const result = await scraper.scrape("https://ubereats.com/store/test");

      expect(result.success).toBe(false);
      expect(result.error).toContain("HTTP 403");
    });

    it("should extract __NEXT_DATA__ state data", async () => {
      const nextData = JSON.stringify({
        props: { pageProps: { store: { name: "UE Store" } } },
      });
      const html = `
        <html><head><title>Test</title></head><body>
        <script id="__NEXT_DATA__" type="application/json">${nextData}</script>
        </body></html>
      `;
      mockFetch.mockResolvedValueOnce(makeResponse(html));

      const result = await scraper.scrape("https://ubereats.com/store/test");

      expect(result.success).toBe(true);
      expect(result.content?.text).toContain("[EMBEDDED STATE]");
    });

    it("should extract __PRELOADED_STATE__ data", async () => {
      const html = `
        <html><head><title>Test</title></head><body>
        <script>window.__PRELOADED_STATE__ = {"store":"data"};</script>
        </body></html>
      `;
      mockFetch.mockResolvedValueOnce(makeResponse(html));

      const result = await scraper.scrape("https://ubereats.com/store/test");

      expect(result.success).toBe(true);
      expect(result.content?.text).toContain("[EMBEDDED STATE]");
    });

    it("should extract JSON-LD for Restaurant type", async () => {
      const jsonLd = JSON.stringify({ "@type": "Restaurant", "name": "UE Restaurant" });
      const html = `
        <html><head><title>Test</title>
        <script type="application/ld+json">${jsonLd}</script>
        </head><body>Content</body></html>
      `;
      mockFetch.mockResolvedValueOnce(makeResponse(html));

      const result = await scraper.scrape("https://ubereats.com/store/test");

      expect(result.success).toBe(true);
      expect(result.content?.text).toContain("[JSON-LD DATA]");
    });

    it("should extract JSON-LD for Menu type", async () => {
      const jsonLd = JSON.stringify({ "@type": "Menu", "name": "UE Menu" });
      const html = `
        <html><head><title>Test</title>
        <script type="application/ld+json">${jsonLd}</script>
        </head><body>Content</body></html>
      `;
      mockFetch.mockResolvedValueOnce(makeResponse(html));

      const result = await scraper.scrape("https://ubereats.com/store/test");

      expect(result.success).toBe(true);
      expect(result.content?.text).toContain("[JSON-LD DATA]");
    });

    it("should extract JSON-LD for array with Restaurant items", async () => {
      const jsonLd = JSON.stringify([{ "@type": "Restaurant", "name": "UE Restaurant" }]);
      const html = `
        <html><head><title>Test</title>
        <script type="application/ld+json">${jsonLd}</script>
        </head><body>Content</body></html>
      `;
      mockFetch.mockResolvedValueOnce(makeResponse(html));

      const result = await scraper.scrape("https://ubereats.com/store/test");

      expect(result.success).toBe(true);
      expect(result.content?.text).toContain("[JSON-LD DATA]");
    });

    it("should handle AbortError (timeout)", async () => {
      const abortError = new Error("Aborted");
      abortError.name = "AbortError";
      mockFetch.mockRejectedValueOnce(abortError);

      const result = await scraper.scrape("https://ubereats.com/store/test");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Request timeout");
    });

    it("should handle generic errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("DNS failed"));

      const result = await scraper.scrape("https://ubereats.com/store/test");

      expect(result.success).toBe(false);
      expect(result.error).toBe("DNS failed");
    });

    it("should handle non-Error throws", async () => {
      mockFetch.mockRejectedValueOnce(null);

      const result = await scraper.scrape("https://ubereats.com/store/test");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown error");
    });

    it("should skip invalid JSON-LD entries", async () => {
      const html = `
        <html><head><title>Test</title>
        <script type="application/ld+json">not valid json at all</script>
        </head><body>Content</body></html>
      `;
      mockFetch.mockResolvedValueOnce(makeResponse(html));

      const result = await scraper.scrape("https://ubereats.com/store/test");

      expect(result.success).toBe(true);
      expect(result.content?.text).not.toContain("[JSON-LD DATA]");
    });
  });
});

// ==================== WebsiteScraper ====================

describe("WebsiteScraper", () => {
  let scraper: WebsiteScraper;

  beforeEach(() => {
    scraper = new WebsiteScraper();
  });

  describe("getName()", () => {
    it("should return website", () => {
      expect(scraper.getName()).toBe("website");
    });
  });

  describe("canHandle()", () => {
    it("should handle generic HTTP URLs", () => {
      expect(scraper.canHandle("https://myrestaurant.com")).toBe(true);
    });

    it("should handle HTTP URLs", () => {
      expect(scraper.canHandle("http://restaurant.com")).toBe(true);
    });

    it("should not handle non-HTTP URLs", () => {
      expect(scraper.canHandle("ftp://files.com")).toBe(false);
    });

    it("should not handle doordash URLs", () => {
      expect(scraper.canHandle("https://doordash.com/store/test")).toBe(false);
    });

    it("should not handle ubereats URLs", () => {
      expect(scraper.canHandle("https://ubereats.com/store/test")).toBe(false);
    });

    it("should not handle google maps URLs", () => {
      expect(scraper.canHandle("https://google.com/maps/place/test")).toBe(false);
    });

    it("should not handle business.google.com URLs", () => {
      expect(scraper.canHandle("https://business.google.com/test")).toBe(false);
    });
  });

  describe("scrape()", () => {
    it("should return success with content", async () => {
      const html = "<html><head><title>My Restaurant</title></head><body>Welcome</body></html>";
      mockFetch.mockResolvedValueOnce(makeResponse(html));

      const result = await scraper.scrape("https://myrestaurant.com");

      expect(result.success).toBe(true);
      expect(result.content?.metadata?.title).toBe("My Restaurant");
    });

    it("should return error for non-OK response", async () => {
      mockFetch.mockResolvedValueOnce(makeResponse("", 500));

      const result = await scraper.scrape("https://myrestaurant.com");

      expect(result.success).toBe(false);
      expect(result.error).toContain("HTTP 500");
    });

    it("should find and scrape menu links", async () => {
      const mainHtml = `
        <html><head><title>Main</title></head><body>
        <a href="/menu">Our Menu</a>
        </body></html>
      `;
      const menuHtml = "<html><head><title>Menu</title></head><body>Pizza $10</body></html>";

      mockFetch
        .mockResolvedValueOnce(makeResponse(mainHtml))
        .mockResolvedValueOnce(makeResponse(menuHtml));

      const result = await scraper.scrape("https://myrestaurant.com");

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      // Combined text should include both pages
      expect(result.content?.text).toContain("Pizza $10");
    });

    it("should handle menu link fetch failure gracefully", async () => {
      const mainHtml = `
        <html><head><title>Main</title></head><body>
        <a href="/menu">Our Menu</a>
        </body></html>
      `;

      mockFetch
        .mockResolvedValueOnce(makeResponse(mainHtml))
        .mockRejectedValueOnce(new Error("Menu fetch failed"));

      const result = await scraper.scrape("https://myrestaurant.com");

      // Should still succeed with main page content
      expect(result.success).toBe(true);
    });

    it("should handle menu link returning non-OK response", async () => {
      const mainHtml = `
        <html><head><title>Main</title></head><body>
        <a href="/menu">Our Menu</a>
        </body></html>
      `;

      mockFetch
        .mockResolvedValueOnce(makeResponse(mainHtml))
        .mockResolvedValueOnce(makeResponse("", 404));

      const result = await scraper.scrape("https://myrestaurant.com");

      expect(result.success).toBe(true);
    });

    it("should find food and order links as menu links", async () => {
      const mainHtml = `
        <html><head><title>Main</title></head><body>
        <a href="/food-menu">Food</a>
        <a href="/order-online">Order Online</a>
        </body></html>
      `;

      mockFetch
        .mockResolvedValueOnce(makeResponse(mainHtml))
        .mockResolvedValueOnce(makeResponse("<html><body>Food items</body></html>"));

      const result = await scraper.scrape("https://myrestaurant.com");

      expect(result.success).toBe(true);
      // Should have fetched the first menu link
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should convert relative URLs to absolute", async () => {
      const mainHtml = `
        <html><head><title>Main</title></head><body>
        <a href="/menu">Menu</a>
        </body></html>
      `;

      mockFetch
        .mockResolvedValueOnce(makeResponse(mainHtml))
        .mockResolvedValueOnce(makeResponse("<html><body>Menu</body></html>"));

      await scraper.scrape("https://myrestaurant.com");

      // Second call should be to the absolute URL
      expect(mockFetch).toHaveBeenCalledTimes(2);
      const secondCallUrl = mockFetch.mock.calls[1][0];
      expect(secondCallUrl).toBe("https://myrestaurant.com/menu");
    });

    it("should not follow external domain links", async () => {
      const mainHtml = `
        <html><head><title>Main</title></head><body>
        <a href="https://otherdomain.com/menu">External Menu</a>
        </body></html>
      `;

      mockFetch.mockResolvedValueOnce(makeResponse(mainHtml));

      const result = await scraper.scrape("https://myrestaurant.com");

      expect(result.success).toBe(true);
      // Should only make 1 fetch call (no external link followed)
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should deduplicate menu links", async () => {
      const mainHtml = `
        <html><head><title>Main</title></head><body>
        <a href="/menu">Menu 1</a>
        <a href="/menu">Menu 2</a>
        </body></html>
      `;

      mockFetch
        .mockResolvedValueOnce(makeResponse(mainHtml))
        .mockResolvedValueOnce(makeResponse("<html><body>Menu page</body></html>"));

      await scraper.scrape("https://myrestaurant.com");

      // 1 for main + 1 for deduplicated menu link
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should handle AbortError (timeout)", async () => {
      const abortError = new Error("Aborted");
      abortError.name = "AbortError";
      mockFetch.mockRejectedValueOnce(abortError);

      const result = await scraper.scrape("https://myrestaurant.com");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Request timeout");
    });

    it("should handle generic errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await scraper.scrape("https://myrestaurant.com");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error");
    });

    it("should handle non-Error throws", async () => {
      mockFetch.mockRejectedValueOnce(undefined);

      const result = await scraper.scrape("https://myrestaurant.com");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown error");
    });

    it("should convert non-http relative links to absolute URLs", async () => {
      const mainHtml = `
        <html><head><title>Main</title></head><body>
        <a href="menu-page">Menu</a>
        </body></html>
      `;

      mockFetch
        .mockResolvedValueOnce(makeResponse(mainHtml))
        .mockResolvedValueOnce(makeResponse("<html><body>Content</body></html>"));

      await scraper.scrape("https://myrestaurant.com");

      const secondCallUrl = mockFetch.mock.calls[1][0];
      expect(secondCallUrl).toBe("https://myrestaurant.com/menu-page");
    });

    it("should extract description and ogImage from metadata", async () => {
      const html = `
        <html><head>
          <title>My Place</title>
          <meta name="description" content="Best pizza in town" />
          <meta property="og:image" content="https://img.com/photo.jpg" />
        </head><body>Content</body></html>
      `;
      mockFetch.mockResolvedValueOnce(makeResponse(html));

      const result = await scraper.scrape("https://myrestaurant.com");

      expect(result.content?.metadata?.description).toBe("Best pizza in town");
      expect(result.content?.metadata?.ogImage).toBe("https://img.com/photo.jpg");
    });
  });
});

// ==================== Scraper Registry ====================

describe("Scraper Registry", () => {
  it("getAllScrapers should return all registered scrapers", () => {
    const scrapers = getAllScrapers();
    expect(scrapers.size).toBe(4);
    expect(scrapers.has("website")).toBe(true);
    expect(scrapers.has("doordash")).toBe(true);
    expect(scrapers.has("ubereats")).toBe(true);
    expect(scrapers.has("google_business")).toBe(true);
  });

  it("detectSourceType should detect doordash URLs", () => {
    expect(detectSourceType("https://www.doordash.com/store/test")).toBe("doordash");
  });

  it("detectSourceType should detect ubereats URLs", () => {
    expect(detectSourceType("https://www.ubereats.com/store/test")).toBe("ubereats");
  });

  it("detectSourceType should default to website for unknown URLs", () => {
    expect(detectSourceType("https://myrestaurant.com")).toBe("website");
  });

  it("getScraper should throw for unknown source type", () => {
    expect(() => getScraper("unknown" as never)).toThrow("Unknown source type: unknown");
  });
});
