import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetStatus = vi.fn();

vi.mock("@/services/generator", () => ({
  getGeneratorService: () => ({ getStatus: mockGetStatus }),
}));

import { GET } from "../[generationId]/status/route";

function makeParams(generationId: string) {
  return { params: Promise.resolve({ generationId }) };
}

describe("GET /api/generator/{generationId}/status", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns generation status", async () => {
    mockGetStatus.mockResolvedValue({
      status: "building", stepDetail: "Creating tenant...",
      companySlug: null, errorMessage: null,
    });
    const req = new NextRequest("http://localhost/api/generator/gen1/status");
    const res = await GET(req, makeParams("gen1"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toEqual({
      success: true,
      data: { status: "building", stepDetail: "Creating tenant...", companySlug: null, errorMessage: null },
    });
  });

  it("returns 404 for non-existent generation", async () => {
    mockGetStatus.mockResolvedValue(null);
    const req = new NextRequest("http://localhost/api/generator/fake/status");
    const res = await GET(req, makeParams("fake"));
    expect(res.status).toBe(404);
  });
});
