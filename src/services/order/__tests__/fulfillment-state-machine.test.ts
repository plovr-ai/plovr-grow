import { describe, it, expect } from "vitest";
import {
  FULFILLMENT_TRANSITIONS,
  canTransition,
  assertTransition,
} from "../fulfillment-state-machine";
import { AppError } from "@/lib/errors";
import type { FulfillmentStatus } from "@/types";

describe("fulfillment-state-machine", () => {
  // ── canTransition ──────────────────────────────────────────────────

  describe("canTransition", () => {
    it("allows pending -> confirmed", () => {
      expect(canTransition("pending", "confirmed")).toBe(true);
    });

    it("allows pending -> canceled", () => {
      expect(canTransition("pending", "canceled")).toBe(true);
    });

    it("allows confirmed -> preparing", () => {
      expect(canTransition("confirmed", "preparing")).toBe(true);
    });

    it("allows confirmed -> canceled", () => {
      expect(canTransition("confirmed", "canceled")).toBe(true);
    });

    it("allows preparing -> ready", () => {
      expect(canTransition("preparing", "ready")).toBe(true);
    });

    it("allows preparing -> canceled", () => {
      expect(canTransition("preparing", "canceled")).toBe(true);
    });

    it("allows ready -> fulfilled", () => {
      expect(canTransition("ready", "fulfilled")).toBe(true);
    });

    it("allows ready -> canceled", () => {
      expect(canTransition("ready", "canceled")).toBe(true);
    });

    it("rejects backward transition: confirmed -> pending", () => {
      expect(canTransition("confirmed", "pending")).toBe(false);
    });

    it("rejects backward transition: preparing -> confirmed", () => {
      expect(canTransition("preparing", "confirmed")).toBe(false);
    });

    it("rejects backward transition: ready -> preparing", () => {
      expect(canTransition("ready", "preparing")).toBe(false);
    });

    it("rejects backward transition: fulfilled -> ready", () => {
      expect(canTransition("fulfilled", "ready")).toBe(false);
    });

    it("rejects skip transition: pending -> preparing", () => {
      expect(canTransition("pending", "preparing")).toBe(false);
    });

    it("rejects skip transition: pending -> ready", () => {
      expect(canTransition("pending", "ready")).toBe(false);
    });

    it("rejects skip transition: confirmed -> ready", () => {
      expect(canTransition("confirmed", "ready")).toBe(false);
    });

    it("rejects skip transition: pending -> fulfilled", () => {
      expect(canTransition("pending", "fulfilled")).toBe(false);
    });

    it("rejects identity transition: pending -> pending", () => {
      expect(canTransition("pending", "pending")).toBe(false);
    });

    it("rejects identity transition: fulfilled -> fulfilled", () => {
      expect(canTransition("fulfilled", "fulfilled")).toBe(false);
    });
  });

  // ── Terminal states ─────────────────────────────────────────────────

  describe("terminal states", () => {
    it("fulfilled has no outgoing transitions", () => {
      expect(FULFILLMENT_TRANSITIONS.fulfilled).toHaveLength(0);
    });

    it("canceled has no outgoing transitions", () => {
      expect(FULFILLMENT_TRANSITIONS.canceled).toHaveLength(0);
    });

    it("rejects any transition from fulfilled", () => {
      const allStatuses: FulfillmentStatus[] = [
        "pending",
        "confirmed",
        "preparing",
        "ready",
        "fulfilled",
        "canceled",
      ];
      for (const to of allStatuses) {
        expect(canTransition("fulfilled", to)).toBe(false);
      }
    });

    it("rejects any transition from canceled", () => {
      const allStatuses: FulfillmentStatus[] = [
        "pending",
        "confirmed",
        "preparing",
        "ready",
        "fulfilled",
        "canceled",
      ];
      for (const to of allStatuses) {
        expect(canTransition("canceled", to)).toBe(false);
      }
    });
  });

  // ── assertTransition ───────────────────────────────────────────────

  describe("assertTransition", () => {
    it("does not throw for valid transitions", () => {
      expect(() => assertTransition("pending", "confirmed")).not.toThrow();
      expect(() => assertTransition("confirmed", "preparing")).not.toThrow();
      expect(() => assertTransition("preparing", "ready")).not.toThrow();
      expect(() => assertTransition("ready", "fulfilled")).not.toThrow();
    });

    it("throws AppError with INVALID_FULFILLMENT_STATUS_TRANSITION for invalid transitions", () => {
      expect(() => assertTransition("fulfilled", "pending")).toThrow(AppError);

      try {
        assertTransition("fulfilled", "pending");
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        const appError = error as AppError;
        expect(appError.code).toBe("INVALID_FULFILLMENT_STATUS_TRANSITION");
        expect(appError.params).toEqual({ from: "fulfilled", to: "pending" });
      }
    });

    it("throws AppError for backward transition", () => {
      expect(() => assertTransition("preparing", "confirmed")).toThrow(AppError);
    });

    it("throws AppError for skip transition", () => {
      expect(() => assertTransition("pending", "ready")).toThrow(AppError);
    });

    it("throws AppError when leaving terminal state", () => {
      expect(() => assertTransition("canceled", "pending")).toThrow(AppError);
      expect(() => assertTransition("fulfilled", "canceled")).toThrow(AppError);
    });
  });

  // ── Full happy-path chain ──────────────────────────────────────────

  describe("full lifecycle", () => {
    it("supports the standard forward chain: pending -> confirmed -> preparing -> ready -> fulfilled", () => {
      const chain: FulfillmentStatus[] = [
        "pending",
        "confirmed",
        "preparing",
        "ready",
        "fulfilled",
      ];

      for (let i = 0; i < chain.length - 1; i++) {
        expect(canTransition(chain[i], chain[i + 1])).toBe(true);
      }
    });

    it("allows cancellation from any non-terminal state", () => {
      const nonTerminal: FulfillmentStatus[] = [
        "pending",
        "confirmed",
        "preparing",
        "ready",
      ];

      for (const status of nonTerminal) {
        expect(canTransition(status, "canceled")).toBe(true);
      }
    });
  });
});
