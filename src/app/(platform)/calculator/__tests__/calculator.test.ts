import { describe, it, expect } from "vitest";
import {
  calculateMonthlyLoss,
  calculateYearlyLoss,
  PLATFORM_FEES,
  type Platform,
} from "../calculator.utils";

describe("calculateMonthlyLoss", () => {
  it("calculates DoorDash loss (25% + 3% = 28%)", () => {
    const result = calculateMonthlyLoss(10000, "doordash");
    expect(result).toBe(2800);
  });

  it("calculates Uber Eats loss (28% + 3% = 31%)", () => {
    const result = calculateMonthlyLoss(10000, "ubereats");
    expect(result).toBe(3100);
  });

  it("calculates Both platforms loss (26.5% + 3% = 29.5%)", () => {
    const result = calculateMonthlyLoss(10000, "both");
    expect(result).toBe(2950);
  });

  it("handles small revenue amounts", () => {
    const result = calculateMonthlyLoss(100, "doordash");
    expect(result).toBe(28);
  });

  it("handles decimal results by rounding to nearest cent", () => {
    const result = calculateMonthlyLoss(333, "doordash");
    expect(result).toBe(93.24);
  });
});

describe("calculateYearlyLoss", () => {
  it("returns monthly loss times 12", () => {
    const result = calculateYearlyLoss(2800);
    expect(result).toBe(33600);
  });
});

describe("PLATFORM_FEES", () => {
  it("has all three platforms defined", () => {
    expect(PLATFORM_FEES.doordash).toBeDefined();
    expect(PLATFORM_FEES.ubereats).toBeDefined();
    expect(PLATFORM_FEES.both).toBeDefined();
  });

  it("each platform has commissionRate and marketingFee", () => {
    const platforms: Platform[] = ["doordash", "ubereats", "both"];
    for (const p of platforms) {
      expect(PLATFORM_FEES[p].commissionRate).toBeGreaterThan(0);
      expect(PLATFORM_FEES[p].marketingFee).toBeGreaterThan(0);
    }
  });
});
