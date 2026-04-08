import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  default: {
    lead: {
      create: mockCreate,
    },
  },
}));

import { POST } from "../route";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/leads", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const validBody = {
  email: "owner@restaurant.com",
  revenue: 5000,
  aov: 25,
  platform: "doordash",
  monthlyLoss: 1400,
};

describe("POST /api/leads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a lead and returns success", async () => {
    mockCreate.mockResolvedValue({ id: "lead-1", ...validBody });
    const res = await POST(makeRequest(validBody));
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data).toEqual({ success: true });
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        email: "owner@restaurant.com",
        revenue: 5000,
        aov: 25,
        platform: "doordash",
        monthlyLoss: 1400,
        source: "calculator",
      },
    });
  });

  it("returns 400 for missing email", async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { email: _, ...noEmail } = validBody;
    const res = await POST(makeRequest(noEmail));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  it("returns 400 for invalid email format", async () => {
    const res = await POST(
      makeRequest({ ...validBody, email: "not-an-email" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for negative revenue", async () => {
    const res = await POST(makeRequest({ ...validBody, revenue: -100 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid platform", async () => {
    const res = await POST(
      makeRequest({ ...validBody, platform: "grubhub" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 500 when database fails", async () => {
    mockCreate.mockRejectedValue(new Error("DB connection failed"));
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  it("accepts customer-loss source", async () => {
    mockCreate.mockResolvedValue({ id: "lead-2", ...validBody, source: "customer-loss" });
    const res = await POST(makeRequest({ ...validBody, source: "customer-loss" }));
    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith({
      data: { ...validBody, source: "customer-loss" },
    });
  });

  it("defaults source to calculator when not provided", async () => {
    mockCreate.mockResolvedValue({ id: "lead-3", ...validBody, source: "calculator" });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith({
      data: { ...validBody, source: "calculator" },
    });
  });

  it("returns 400 for invalid source", async () => {
    const res = await POST(makeRequest({ ...validBody, source: "unknown" }));
    expect(res.status).toBe(400);
  });
});
