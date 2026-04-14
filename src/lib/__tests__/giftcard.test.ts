import { describe, it, expect } from "vitest";
import {
  generateGiftCardNumber,
  normalizeGiftCardNumber,
  formatGiftCardNumber,
  isValidGiftCardFormat,
} from "../giftcard";

describe("generateGiftCardNumber", () => {
  it("should generate a card number in format XXXX-XXXX-XXXX-XXXX", () => {
    const cardNumber = generateGiftCardNumber();
    expect(cardNumber).toMatch(/^\d{4}-\d{4}-\d{4}-\d{4}$/);
  });

  it("should generate 16 digits total", () => {
    const cardNumber = generateGiftCardNumber();
    const digitsOnly = cardNumber.replace(/-/g, "");
    expect(digitsOnly).toHaveLength(16);
  });

  it("should only contain digits", () => {
    const cardNumber = generateGiftCardNumber();
    const digitsOnly = cardNumber.replace(/-/g, "");
    expect(digitsOnly).toMatch(/^\d+$/);
  });

  it("should generate different numbers on each call", () => {
    const numbers = new Set<string>();
    for (let i = 0; i < 100; i++) {
      numbers.add(generateGiftCardNumber());
    }
    // With 16 digits, collisions should be extremely rare
    expect(numbers.size).toBe(100);
  });
});

describe("normalizeGiftCardNumber", () => {
  it("should remove dashes from card number", () => {
    expect(normalizeGiftCardNumber("1234-5678-9012-3456")).toBe(
      "1234567890123456"
    );
  });

  it("should remove spaces from card number", () => {
    expect(normalizeGiftCardNumber("1234 5678 9012 3456")).toBe(
      "1234567890123456"
    );
  });

  it("should remove both dashes and spaces", () => {
    expect(normalizeGiftCardNumber("1234-5678 9012-3456")).toBe(
      "1234567890123456"
    );
  });

  it("should return the same string if already normalized", () => {
    expect(normalizeGiftCardNumber("1234567890123456")).toBe(
      "1234567890123456"
    );
  });
});

describe("formatGiftCardNumber", () => {
  it("should format 16 digits into XXXX-XXXX-XXXX-XXXX", () => {
    expect(formatGiftCardNumber("1234567890123456")).toBe(
      "1234-5678-9012-3456"
    );
  });

  it("should handle already formatted input", () => {
    expect(formatGiftCardNumber("1234-5678-9012-3456")).toBe(
      "1234-5678-9012-3456"
    );
  });

  it("should handle partial input", () => {
    expect(formatGiftCardNumber("12345678")).toBe("1234-5678");
  });

  it("should handle empty string", () => {
    expect(formatGiftCardNumber("")).toBe("");
  });
});

describe("isValidGiftCardFormat", () => {
  describe("valid formats", () => {
    it("should accept XXXX-XXXX-XXXX-XXXX format", () => {
      expect(isValidGiftCardFormat("1234-5678-9012-3456")).toBe(true);
    });

    it("should accept 16 consecutive digits", () => {
      expect(isValidGiftCardFormat("1234567890123456")).toBe(true);
    });

    it("should accept all zeros", () => {
      expect(isValidGiftCardFormat("0000-0000-0000-0000")).toBe(true);
      expect(isValidGiftCardFormat("0000000000000000")).toBe(true);
    });

    it("should accept all nines", () => {
      expect(isValidGiftCardFormat("9999-9999-9999-9999")).toBe(true);
      expect(isValidGiftCardFormat("9999999999999999")).toBe(true);
    });
  });

  describe("invalid formats", () => {
    it("should reject letters", () => {
      expect(isValidGiftCardFormat("ABCD-EFGH-IJKL-MNOP")).toBe(false);
      expect(isValidGiftCardFormat("1234-ABCD-5678-EFGH")).toBe(false);
    });

    it("should reject old GC- prefix format", () => {
      expect(isValidGiftCardFormat("GC-1234-5678-9012")).toBe(false);
    });

    it("should reject wrong number of digits", () => {
      expect(isValidGiftCardFormat("1234-5678-9012")).toBe(false); // 12 digits
      expect(isValidGiftCardFormat("1234-5678-9012-3456-7890")).toBe(false); // 20 digits
      expect(isValidGiftCardFormat("123456789012")).toBe(false); // 12 digits
    });

    it("should reject wrong dash positions", () => {
      expect(isValidGiftCardFormat("12345-678-9012-3456")).toBe(false);
      expect(isValidGiftCardFormat("1234-56789-012-3456")).toBe(false);
    });

    it("should reject special characters", () => {
      expect(isValidGiftCardFormat("1234-5678-9012-345@")).toBe(false);
      expect(isValidGiftCardFormat("1234_5678_9012_3456")).toBe(false);
    });

    it("should reject empty string", () => {
      expect(isValidGiftCardFormat("")).toBe(false);
    });

    it("should reject spaces", () => {
      expect(isValidGiftCardFormat("1234 5678 9012 3456")).toBe(false);
    });
  });
});
