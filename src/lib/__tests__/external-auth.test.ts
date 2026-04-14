import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { validateExternalRequest } from "../external-auth";

describe("validateExternalRequest", () => {
  it("returns authenticated: true (stub)", async () => {
    const request = new NextRequest("http://localhost/api/external/v1/health");
    const result = await validateExternalRequest(request);
    expect(result).toEqual({ authenticated: true });
  });
});
