import { describe, it, expect, beforeEach, vi } from "vitest"
import { GET } from "../route"

vi.mock("@/services/stripe-connect", () => ({
  stripeConnectService: {
    parseOAuthState: vi.fn(),
    handleOAuthCallback: vi.fn(),
  },
}))

import { stripeConnectService } from "@/services/stripe-connect"

const DASHBOARD_URL = "http://localhost:3000/dashboard/settings"

describe("GET /api/auth/stripe/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should redirect to dashboard with success on valid code and state", async () => {
    vi.mocked(stripeConnectService.parseOAuthState).mockReturnValue({ tenantId: "tenant-123" })
    vi.mocked(stripeConnectService.handleOAuthCallback).mockResolvedValue({
      stripeAccountId: "acct_test_123",
      chargesEnabled: true,
      payoutsEnabled: true,
      detailsSubmitted: true,
    })

    const request = new Request(
      "http://localhost:3000/api/auth/stripe/callback?code=test_code&state=encoded_state"
    )
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe(`${DASHBOARD_URL}?stripe_connect=success`)
    expect(stripeConnectService.parseOAuthState).toHaveBeenCalledWith("encoded_state")
    expect(stripeConnectService.handleOAuthCallback).toHaveBeenCalledWith("test_code", "tenant-123")
  })

  it("should redirect with error when error param is present", async () => {
    const request = new Request(
      "http://localhost:3000/api/auth/stripe/callback?error=access_denied&error_description=User+denied+access"
    )
    const response = await GET(request)

    expect(response.status).toBe(307)
    const location = response.headers.get("location")!
    expect(location).toContain("stripe_connect=error")
    expect(location).toContain(encodeURIComponent("User denied access"))
    expect(stripeConnectService.parseOAuthState).not.toHaveBeenCalled()
    expect(stripeConnectService.handleOAuthCallback).not.toHaveBeenCalled()
  })

  it("should redirect with 'Unknown error' when error param is present without description", async () => {
    const request = new Request(
      "http://localhost:3000/api/auth/stripe/callback?error=access_denied"
    )
    const response = await GET(request)

    expect(response.status).toBe(307)
    const location = response.headers.get("location")!
    expect(location).toContain("stripe_connect=error")
    expect(location).toContain(encodeURIComponent("Unknown error"))
  })

  it("should redirect with 'Missing parameters' when code is missing", async () => {
    const request = new Request(
      "http://localhost:3000/api/auth/stripe/callback?state=encoded_state"
    )
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe(
      `${DASHBOARD_URL}?stripe_connect=error&message=Missing+parameters`
    )
  })

  it("should redirect with 'Missing parameters' when state is missing", async () => {
    const request = new Request(
      "http://localhost:3000/api/auth/stripe/callback?code=test_code"
    )
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe(
      `${DASHBOARD_URL}?stripe_connect=error&message=Missing+parameters`
    )
  })

  it("should redirect with error message when handleOAuthCallback throws", async () => {
    vi.mocked(stripeConnectService.parseOAuthState).mockReturnValue({ tenantId: "tenant-123" })
    vi.mocked(stripeConnectService.handleOAuthCallback).mockRejectedValue(
      new Error("Already connected")
    )

    const request = new Request(
      "http://localhost:3000/api/auth/stripe/callback?code=test_code&state=encoded_state"
    )
    const response = await GET(request)

    expect(response.status).toBe(307)
    const location = response.headers.get("location")!
    expect(location).toContain("stripe_connect=error")
    expect(location).toContain(encodeURIComponent("Already connected"))
  })

  it("should redirect with 'Connection failed' when a non-Error is thrown", async () => {
    vi.mocked(stripeConnectService.parseOAuthState).mockReturnValue({ tenantId: "tenant-123" })
    vi.mocked(stripeConnectService.handleOAuthCallback).mockRejectedValue("some string error")

    const request = new Request(
      "http://localhost:3000/api/auth/stripe/callback?code=test_code&state=encoded_state"
    )
    const response = await GET(request)

    expect(response.status).toBe(307)
    const location = response.headers.get("location")!
    expect(location).toContain("stripe_connect=error")
    expect(location).toContain(encodeURIComponent("Connection failed"))
  })
})
