import { describe, it, expect, vi } from "vitest";
import { slugify, generateUniqueSlug } from "../slug.util";

describe("slugify", () => {
  it("converts name to lowercase kebab-case", () => {
    expect(slugify("Joe's Pizza")).toBe("joes-pizza");
  });

  it("handles special characters", () => {
    expect(slugify("Café & Bistro!")).toBe("cafe-bistro");
  });

  it("trims leading/trailing hyphens", () => {
    expect(slugify("  --Hello World--  ")).toBe("hello-world");
  });

  it("collapses multiple hyphens", () => {
    expect(slugify("A   B   C")).toBe("a-b-c");
  });

  it("handles unicode characters", () => {
    expect(slugify("Über Noodles 日本")).toBe("uber-noodles");
  });

  it("returns fallback for empty result", () => {
    expect(slugify("!!!")).toBe("restaurant");
  });
});

describe("generateUniqueSlug", () => {
  it("returns base slug when available", async () => {
    const isAvailable = vi.fn().mockResolvedValue(true);
    const result = await generateUniqueSlug("Joe's Pizza", isAvailable);
    expect(result).toBe("joes-pizza");
    expect(isAvailable).toHaveBeenCalledWith("joes-pizza");
  });

  it("appends suffix when base slug is taken", async () => {
    const isAvailable = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const result = await generateUniqueSlug("Joe's Pizza", isAvailable);
    expect(result).toBe("joes-pizza-2");
  });

  it("increments suffix until available", async () => {
    const isAvailable = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const result = await generateUniqueSlug("Joe's Pizza", isAvailable);
    expect(result).toBe("joes-pizza-4");
  });

  it("falls back to timestamp suffix when all 100 suffixes are taken", async () => {
    const isAvailable = vi.fn().mockResolvedValue(false);
    const before = Date.now();
    const result = await generateUniqueSlug("Joe's Pizza", isAvailable);
    const after = Date.now();

    expect(result).toMatch(/^joes-pizza-\d+$/);
    // The timestamp suffix should be between before and after
    const timestamp = parseInt(result.replace("joes-pizza-", ""), 10);
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
    // Base + 100 suffixes (2-100) = 100 calls
    expect(isAvailable).toHaveBeenCalledTimes(100);
  });
});
