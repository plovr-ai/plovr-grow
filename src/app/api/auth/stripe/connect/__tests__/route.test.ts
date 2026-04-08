import { describe, it, expect, beforeEach, vi } from "vitest"
import { GET } from "../route"

vi.mock("@/services/stripe-connect", () => ({
  stripeConnectService: {
    generateOAuthUrl: vi.fn(),
  },
}))

import { stripeConnectService } from "@/services/stripe-connect"

describe("GET /api/auth/stripe/connect", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return 400 when tenantId is missing", async () => {
    const request = new Request("http://localhost:3000/api/auth/stripe/connect")
    const response = await GET(request)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body).toEqual({ error: "tenantId is required" })
  })

  it("should redirect to OAuth URL when tenantId is provided", async () => {
    const oauthUrl = "https://connect.stripe.com/oauth/authorize?client_id=ca_test&state=abc"
    vi.mocked(stripeConnectService.generateOAuthUrl).mockReturnValue(oauthUrl)

    const request = new Request("http://localhost:3000/api/auth/stripe/connect?tenantId=tenant-123")
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe(oauthUrl)
    expect(stripeConnectService.generateOAuthUrl).toHaveBeenCalledWith(
      "tenant-123",
      "http://localhost:3000/api/auth/stripe/callback"
    )
  })
})
