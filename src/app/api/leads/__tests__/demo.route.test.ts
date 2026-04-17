import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockCreateDemoLead } = vi.hoisted(() => ({
  mockCreateDemoLead: vi.fn(),
}));

vi.mock("@/services/leads/leads.service", () => ({
  leadsService: {
    createDemoLead: mockCreateDemoLead,
  },
}));

vi.mock("@/lib/logger", () => ({
  createRequestLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock("@sentry/nextjs", () => ({
  withScope: vi.fn((cb: (scope: unknown) => void) =>
    cb({ setTag: vi.fn(), setContext: vi.fn() })
  ),
  captureException: vi.fn(),
}));

import { POST } from "../demo/route";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/leads/demo", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const validBody = {
  restaurantName: "Joe's Pizza",
  email: "owner@joespizza.com",
  firstName: "Joe",
  phone: "+14155551234",
};

const routeContext = { params: Promise.resolve({}) };

describe("POST /api/leads/demo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a demo lead and returns 201", async () => {
    mockCreateDemoLead.mockResolvedValue({ id: "lead-demo-1" });

    const res = await POST(makeRequest(validBody), routeContext);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data).toEqual({ success: true });
    expect(mockCreateDemoLead).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantName: "Joe's Pizza",
        email: "owner@joespizza.com",
        firstName: "Joe",
        phone: "+14155551234",
        smsConsent: false,
      })
    );
  });

  it("passes optional fields through to service", async () => {
    mockCreateDemoLead.mockResolvedValue({ id: "lead-demo-2" });

    await POST(
      makeRequest({
        ...validBody,
        lastName: "Smith",
        placeId: "place-1",
        utmSource: "google",
        smsConsent: true,
      }),
      routeContext
    );

    expect(mockCreateDemoLead).toHaveBeenCalledWith(
      expect.objectContaining({
        lastName: "Smith",
        placeId: "place-1",
        utmSource: "google",
        smsConsent: true,
      })
    );
  });

  it("returns 400 when restaurantName missing", async () => {
    const { restaurantName: _unused, ...rest } = validBody;
    const res = await POST(makeRequest(rest), routeContext);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(mockCreateDemoLead).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid email", async () => {
    const res = await POST(
      makeRequest({ ...validBody, email: "not-an-email" }),
      routeContext
    );
    expect(res.status).toBe(400);
    expect(mockCreateDemoLead).not.toHaveBeenCalled();
  });

  it("returns 500 when service throws", async () => {
    mockCreateDemoLead.mockRejectedValue(new Error("DB down"));

    const res = await POST(makeRequest(validBody), routeContext);

    expect(res.status).toBe(500);
  });
});
