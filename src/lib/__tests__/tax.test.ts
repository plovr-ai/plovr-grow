import { describe, it, expect } from "vitest";
import { applyRounding } from "../tax";

describe("applyRounding", () => {
  describe("half_up (standard rounding)", () => {
    it("should round 0.124 to 0.12", () => {
      expect(applyRounding(0.124, "half_up")).toBe(0.12);
    });

    it("should round 0.125 to 0.13 (half rounds up)", () => {
      expect(applyRounding(0.125, "half_up")).toBe(0.13);
    });

    it("should round 0.126 to 0.13", () => {
      expect(applyRounding(0.126, "half_up")).toBe(0.13);
    });

    it("should round 1.565 to 1.57", () => {
      expect(applyRounding(1.565, "half_up")).toBe(1.57);
    });
  });

  describe("half_even (banker's rounding)", () => {
    it("should round 0.125 to 0.12 (even)", () => {
      expect(applyRounding(0.125, "half_even")).toBe(0.12);
    });

    it("should round 0.135 to 0.14 (even)", () => {
      expect(applyRounding(0.135, "half_even")).toBe(0.14);
    });

    it("should round 0.145 to 0.14 (even)", () => {
      expect(applyRounding(0.145, "half_even")).toBe(0.14);
    });

    it("should round 0.155 to 0.16 (even)", () => {
      expect(applyRounding(0.155, "half_even")).toBe(0.16);
    });

    it("should round 0.126 to 0.13 (not exactly 0.5)", () => {
      expect(applyRounding(0.126, "half_even")).toBe(0.13);
    });
  });

  describe("always_round_up (ceiling)", () => {
    it("should round 0.121 to 0.13", () => {
      expect(applyRounding(0.121, "always_round_up")).toBe(0.13);
    });

    it("should round 0.129 to 0.13", () => {
      expect(applyRounding(0.129, "always_round_up")).toBe(0.13);
    });

    it("should keep 0.12 as 0.12", () => {
      expect(applyRounding(0.12, "always_round_up")).toBe(0.12);
    });

    it("should round 1.001 to 1.01", () => {
      expect(applyRounding(1.001, "always_round_up")).toBe(1.01);
    });
  });

  describe("always_round_down (floor)", () => {
    it("should round 0.129 to 0.12", () => {
      expect(applyRounding(0.129, "always_round_down")).toBe(0.12);
    });

    it("should round 0.121 to 0.12", () => {
      expect(applyRounding(0.121, "always_round_down")).toBe(0.12);
    });

    it("should keep 0.12 as 0.12", () => {
      expect(applyRounding(0.12, "always_round_down")).toBe(0.12);
    });

    it("should round 1.999 to 1.99", () => {
      expect(applyRounding(1.999, "always_round_down")).toBe(1.99);
    });
  });
});
