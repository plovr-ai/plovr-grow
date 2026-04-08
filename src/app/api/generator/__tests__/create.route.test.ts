import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockCreate = vi.fn();
const mockGenerate = vi.fn();

vi.mock("@/services/generator", () => ({
  getGeneratorService: () => ({
    create: mockCreate,
    generate: mockGenerate,
  }),
}));

import { POST } from "../create/route";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/generator/create", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/generator/create", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns existingSlug when placeId already generated", async () => {
    mockCreate.mockResolvedValue({ existingSlug: "joes-pizza" });
    const res = await POST(makeRequest({ placeId: "ChIJ_test", placeName: "Joe's Pizza" }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true, data: { existingSlug: "joes-pizza" } });
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("returns generationId and triggers async generation", async () => {
    mockCreate.mockResolvedValue({ generationId: "gen-123" });
    mockGenerate.mockResolvedValue(undefined);
    const res = await POST(makeRequest({ placeId: "ChIJ_new", placeName: "New Place" }));
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data).toEqual({ success: true, data: { generationId: "gen-123" } });
    expect(mockGenerate).toHaveBeenCalledWith("gen-123");
  });

  it("returns 400 for missing placeId", async () => {
    const res = await POST(makeRequest({ placeName: "No Place ID" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing placeName", async () => {
    const res = await POST(makeRequest({ placeId: "ChIJ_test" }));
    expect(res.status).toBe(400);
  });
});
