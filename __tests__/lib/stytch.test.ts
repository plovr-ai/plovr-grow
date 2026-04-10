import { describe, it, expect, vi, beforeEach } from "vitest";

describe("stytch client", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("getStytchServerClient returns a stytch Client instance", async () => {
    vi.stubEnv("STYTCH_PROJECT_ID", "project-test-123");
    vi.stubEnv("STYTCH_SECRET", "secret-test-456");

    const { getStytchServerClient } = await import("@/lib/stytch");
    const client = getStytchServerClient();
    expect(client).toBeDefined();
    expect(client.sessions).toBeDefined();
  });

  it("throws if STYTCH_PROJECT_ID is missing", async () => {
    vi.stubEnv("STYTCH_PROJECT_ID", "");
    vi.stubEnv("STYTCH_SECRET", "secret-test-456");

    const { getStytchServerClient } = await import("@/lib/stytch");
    expect(() => getStytchServerClient()).toThrow("STYTCH_PROJECT_ID");
  });

  it("throws if STYTCH_SECRET is missing", async () => {
    vi.stubEnv("STYTCH_PROJECT_ID", "project-test-123");
    vi.stubEnv("STYTCH_SECRET", "");

    const { getStytchServerClient } = await import("@/lib/stytch");
    expect(() => getStytchServerClient()).toThrow("STYTCH_SECRET");
  });

  it("returns cached client on subsequent calls", async () => {
    vi.stubEnv("STYTCH_PROJECT_ID", "project-test-123");
    vi.stubEnv("STYTCH_SECRET", "secret-test-456");

    const { getStytchServerClient } = await import("@/lib/stytch");
    const client1 = getStytchServerClient();
    const client2 = getStytchServerClient();
    expect(client1).toBe(client2);
  });
});
