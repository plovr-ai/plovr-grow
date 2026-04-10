import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useCartHydration } from "../useCartHydration";

describe("useCartHydration", () => {
  it("should return true on the client side", () => {
    const { result } = renderHook(() => useCartHydration());
    expect(result.current).toBe(true);
  });
});
