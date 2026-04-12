import { describe, it, expect } from "vitest";
import type { FulfillmentStatus } from "@/types";
import { AppError } from "@/lib/errors";
import {
  FULFILLMENT_TRANSITIONS,
  canTransition,
  assertTransition,
} from "../fulfillment-state-machine";

describe("fulfillment-state-machine", () => {
  describe("FULFILLMENT_TRANSITIONS", () => {
    it("should define transitions for all known statuses", () => {
      const statuses: FulfillmentStatus[] = [
        "pending",
        "confirmed",
        "preparing",
        "ready",
        "fulfilled",
        "canceled",
      ];

      for (const status of statuses) {
        expect(FULFILLMENT_TRANSITIONS).toHaveProperty(status);
        expect(Array.isArray(FULFILLMENT_TRANSITIONS[status])).toBe(true);
      }
    });

    it("should have no outgoing transitions for terminal states", () => {
      expect(FULFILLMENT_TRANSITIONS.fulfilled).toEqual([]);
      expect(FULFILLMENT_TRANSITIONS.canceled).toEqual([]);
    });
  });

  describe("canTransition()", () => {
    describe("valid forward transitions", () => {
      const validCases: [FulfillmentStatus, FulfillmentStatus][] = [
        ["pending", "confirmed"],
        ["confirmed", "preparing"],
        ["preparing", "ready"],
        ["ready", "fulfilled"],
      ];

      it.each(validCases)(
        "should allow %s → %s",
        (from, to) => {
          expect(canTransition(from, to)).toBe(true);
        }
      );
    });

    describe("valid transitions to canceled", () => {
      const cancelableSources: FulfillmentStatus[] = [
        "pending",
        "confirmed",
        "preparing",
        "ready",
      ];

      it.each(cancelableSources)(
        "should allow %s → canceled",
        (from) => {
          expect(canTransition(from, "canceled")).toBe(true);
        }
      );
    });

    describe("invalid backward transitions", () => {
      const backwardCases: [FulfillmentStatus, FulfillmentStatus][] = [
        ["confirmed", "pending"],
        ["preparing", "confirmed"],
        ["ready", "preparing"],
        ["fulfilled", "ready"],
      ];

      it.each(backwardCases)(
        "should reject %s → %s",
        (from, to) => {
          expect(canTransition(from, to)).toBe(false);
        }
      );
    });

    describe("valid forward-jump transitions (for coarse POS integrations)", () => {
      const jumpCases: [FulfillmentStatus, FulfillmentStatus][] = [
        ["pending", "preparing"],
        ["pending", "ready"],
        ["pending", "fulfilled"],
        ["confirmed", "ready"],
        ["confirmed", "fulfilled"],
        ["preparing", "fulfilled"],
      ];

      it.each(jumpCases)(
        "should allow forward jump %s → %s",
        (from, to) => {
          expect(canTransition(from, to)).toBe(true);
        }
      );
    });

    describe("terminal states have no outgoing transitions", () => {
      const targets: FulfillmentStatus[] = [
        "pending",
        "confirmed",
        "preparing",
        "ready",
        "fulfilled",
        "canceled",
      ];

      it.each(targets)(
        "should reject fulfilled → %s",
        (to) => {
          expect(canTransition("fulfilled", to)).toBe(false);
        }
      );

      it.each(targets)(
        "should reject canceled → %s",
        (to) => {
          expect(canTransition("canceled", to)).toBe(false);
        }
      );
    });

    it("should return false for unknown status values", () => {
      expect(
        canTransition("unknown_status" as FulfillmentStatus, "confirmed")
      ).toBe(false);
    });
  });

  describe("assertTransition()", () => {
    it("should not throw for valid transitions", () => {
      expect(() => assertTransition("pending", "confirmed")).not.toThrow();
      expect(() => assertTransition("confirmed", "preparing")).not.toThrow();
      expect(() => assertTransition("preparing", "ready")).not.toThrow();
      expect(() => assertTransition("ready", "fulfilled")).not.toThrow();
      expect(() => assertTransition("pending", "canceled")).not.toThrow();
    });

    it("should throw AppError with correct code for invalid transition", () => {
      try {
        assertTransition("preparing", "pending");
        expect.fail("Expected assertTransition to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        const appError = error as AppError;
        expect(appError.code).toBe("INVALID_FULFILLMENT_STATUS_TRANSITION");
        expect(appError.params).toEqual({ from: "preparing", to: "pending" });
      }
    });

    it("should throw AppError for terminal state transitions", () => {
      try {
        assertTransition("fulfilled", "canceled");
        expect.fail("Expected assertTransition to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        const appError = error as AppError;
        expect(appError.code).toBe("INVALID_FULFILLMENT_STATUS_TRANSITION");
        expect(appError.params).toEqual({ from: "fulfilled", to: "canceled" });
      }
    });
  });
});
