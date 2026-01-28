import { describe, it, expect } from "vitest";
import { generateEntityId } from "../id";

describe("ID Generation", () => {
  describe("generateEntityId", () => {
    it("should generate valid UUID v4", () => {
      const id = generateEntityId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it("should generate unique IDs", () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateEntityId()));
      expect(ids.size).toBe(100);
    });

    it("should generate different IDs on each call", () => {
      const id1 = generateEntityId();
      const id2 = generateEntityId();
      expect(id1).not.toBe(id2);
    });
  });
});
