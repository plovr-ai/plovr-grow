import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetAllPosts = vi.hoisted(() =>
  vi.fn(() => [
    {
      slug: "hello-world",
      frontmatter: {
        title: "Hello World",
        description: "First post",
        date: "2025-01-15",
        author: { name: "Test" },
        tags: ["test"],
        draft: false,
      },
      content: "Hello",
    },
    {
      slug: "second-post",
      frontmatter: {
        title: "Second Post",
        description: "Second post",
        date: "2025-02-20",
        author: { name: "Test" },
        tags: ["test"],
        draft: false,
      },
      content: "World",
    },
  ])
);

vi.mock("@/lib/content", () => ({
  getAllPosts: mockGetAllPosts,
}));

import sitemap from "../sitemap";

describe("sitemap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns expected static pages", () => {
    const result = sitemap();

    const urls = result.map((entry) => entry.url);
    expect(urls).toContain("https://www.localgrow.ai/");
    expect(urls).toContain("https://www.localgrow.ai/about");
    expect(urls).toContain("https://www.localgrow.ai/pricing");
    expect(urls).toContain("https://www.localgrow.ai/blog");
    expect(urls).toContain("https://www.localgrow.ai/releases");
    expect(urls).toContain("https://www.localgrow.ai/calculator");
    expect(urls).toContain("https://www.localgrow.ai/customer-loss");
    expect(urls).toContain("https://www.localgrow.ai/generator");
  });

  it("uses correct base URL for all entries", () => {
    const result = sitemap();

    for (const entry of result) {
      expect(entry.url).toMatch(/^https:\/\/www\.localgrow\.ai\//);
    }
  });

  it("assigns correct priority to homepage", () => {
    const result = sitemap();
    const homepage = result.find((e) => e.url === "https://www.localgrow.ai/");
    expect(homepage?.priority).toBe(1.0);
  });

  it("assigns correct priority to pricing", () => {
    const result = sitemap();
    const pricing = result.find((e) => e.url === "https://www.localgrow.ai/pricing");
    expect(pricing?.priority).toBe(0.9);
  });

  it("includes dynamic blog post entries", () => {
    const result = sitemap();

    const urls = result.map((entry) => entry.url);
    expect(urls).toContain("https://www.localgrow.ai/blog/hello-world");
    expect(urls).toContain("https://www.localgrow.ai/blog/second-post");
  });

  it("sets lastModified on blog entries from post date", () => {
    const result = sitemap();

    const blogEntry = result.find((e) => e.url === "https://www.localgrow.ai/blog/hello-world");
    expect(blogEntry?.lastModified).toEqual(new Date("2025-01-15"));
  });

  it("excludes transactional pages", () => {
    const result = sitemap();

    const urls = result.map((entry) => entry.url);
    expect(urls).not.toContain("https://www.localgrow.ai/claim/success");
    expect(urls).not.toContain(expect.stringContaining("/progress"));
  });

  it("returns only published posts from getAllPosts", () => {
    // getAllPosts already filters drafts based on NODE_ENV,
    // so the sitemap simply includes whatever getAllPosts returns
    mockGetAllPosts.mockReturnValueOnce([]);

    const result = sitemap();
    const blogUrls = result.filter((e) => e.url.includes("/blog/") && e.url !== "https://www.localgrow.ai/blog");
    expect(blogUrls).toHaveLength(0);
  });
});
