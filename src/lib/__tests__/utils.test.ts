import { describe, it, expect } from "vitest";
import {
  formatPrice,
  formatPhone,
  formatPhoneInput,
  generateOrderNumber,
  generateCateringOrderNumber,
  generateGiftcardOrderNumber,
  generateInvoiceNumber,
  cn,
} from "../utils";

describe("formatPrice", () => {
  describe("USD currency", () => {
    it("should format price in USD with en-US locale", () => {
      expect(formatPrice(100, "USD", "en-US")).toBe("$100.00");
    });

    it("should format decimal price correctly", () => {
      expect(formatPrice(18.99, "USD", "en-US")).toBe("$18.99");
    });

    it("should format large numbers with thousand separators", () => {
      expect(formatPrice(1234.56, "USD", "en-US")).toBe("$1,234.56");
    });

    it("should use USD and en-US as defaults", () => {
      expect(formatPrice(50)).toBe("$50.00");
    });

    it("should handle string input", () => {
      expect(formatPrice("25.50", "USD", "en-US")).toBe("$25.50");
    });

    it("should handle zero", () => {
      expect(formatPrice(0, "USD", "en-US")).toBe("$0.00");
    });
  });

  describe("EUR currency", () => {
    it("should format price in EUR with de-DE locale", () => {
      const result = formatPrice(100, "EUR", "de-DE");
      // German format: 100,00 € (with non-breaking space)
      expect(result).toContain("100,00");
      expect(result).toContain("€");
    });

    it("should format price in EUR with en-US locale", () => {
      expect(formatPrice(100, "EUR", "en-US")).toBe("€100.00");
    });

    it("should format decimal price in EUR with de-DE locale", () => {
      const result = formatPrice(18.99, "EUR", "de-DE");
      expect(result).toContain("18,99");
      expect(result).toContain("€");
    });
  });

  describe("CNY currency", () => {
    it("should format price in CNY with zh-CN locale", () => {
      const result = formatPrice(100, "CNY", "zh-CN");
      expect(result).toContain("100.00");
      expect(result).toContain("¥");
    });

    it("should format decimal price in CNY", () => {
      const result = formatPrice(18.99, "CNY", "zh-CN");
      expect(result).toContain("18.99");
      expect(result).toContain("¥");
    });
  });

  describe("JPY currency", () => {
    it("should format price in JPY without decimals", () => {
      const result = formatPrice(100, "JPY", "ja-JP");
      // JPY doesn't use decimal places
      expect(result).toContain("100");
      expect(result).toContain("￥");
    });

    it("should round JPY to whole number", () => {
      const result = formatPrice(99.5, "JPY", "ja-JP");
      // Should round to 100 or 99 depending on implementation
      expect(result).toMatch(/￥(99|100)/);
    });
  });

  describe("GBP currency", () => {
    it("should format price in GBP with en-GB locale", () => {
      expect(formatPrice(100, "GBP", "en-GB")).toBe("£100.00");
    });
  });

  describe("edge cases", () => {
    it("should handle negative numbers", () => {
      const result = formatPrice(-50, "USD", "en-US");
      expect(result).toContain("50.00");
      expect(result).toContain("-");
    });

    it("should handle very small numbers", () => {
      expect(formatPrice(0.01, "USD", "en-US")).toBe("$0.01");
    });

    it("should handle very large numbers", () => {
      const result = formatPrice(1000000, "USD", "en-US");
      expect(result).toBe("$1,000,000.00");
    });
  });
});

describe("cn", () => {
  it("should merge tailwind classes", () => {
    const result = cn("px-4", "py-2", "px-6");
    expect(result).toContain("px-6");
    expect(result).toContain("py-2");
    expect(result).not.toContain("px-4");
  });

  it("should handle conditional classes", () => {
    const result = cn("base", false && "hidden", "visible");
    expect(result).toContain("base");
    expect(result).toContain("visible");
  });
});

describe("generateOrderNumber", () => {
  it("should generate order number without timezone (UTC)", () => {
    const result = generateOrderNumber(42);
    expect(result).toMatch(/^\d{8}-0042$/);
  });

  it("should generate order number with timezone", () => {
    const result = generateOrderNumber(1, "America/New_York");
    expect(result).toMatch(/^\d{8}-0001$/);
  });

  it("should pad sequence to 4 digits", () => {
    const result = generateOrderNumber(1);
    expect(result).toMatch(/-0001$/);
  });
});

describe("generateCateringOrderNumber", () => {
  it("should generate catering order number without timezone", () => {
    const result = generateCateringOrderNumber(5);
    expect(result).toMatch(/^CTR-\d{8}-0005$/);
  });

  it("should generate catering order number with timezone", () => {
    const result = generateCateringOrderNumber(1, "America/Los_Angeles");
    expect(result).toMatch(/^CTR-\d{8}-0001$/);
  });
});

describe("generateGiftcardOrderNumber", () => {
  it("should generate giftcard order number without timezone", () => {
    const result = generateGiftcardOrderNumber(3);
    expect(result).toMatch(/^GC-\d{8}-0003$/);
  });

  it("should generate giftcard order number with timezone", () => {
    const result = generateGiftcardOrderNumber(1, "America/Chicago");
    expect(result).toMatch(/^GC-\d{8}-0001$/);
  });
});

describe("generateInvoiceNumber", () => {
  it("should generate invoice number with padded sequence", () => {
    expect(generateInvoiceNumber(1)).toBe("INV-000001");
    expect(generateInvoiceNumber(42)).toBe("INV-000042");
    expect(generateInvoiceNumber(123456)).toBe("INV-123456");
  });
});

describe("formatPhone", () => {
  describe("US locale (en-US)", () => {
    it("should format 10-digit US phone number", () => {
      expect(formatPhone("2125550100", "en-US")).toBe("(212) 555-0100");
    });

    it("should format phone number with +1 country code", () => {
      expect(formatPhone("+12125550100", "en-US")).toBe("(212) 555-0100");
    });

    it("should format phone number with 1 country code (no plus)", () => {
      expect(formatPhone("12125550100", "en-US")).toBe("(212) 555-0100");
    });

    it("should handle phone number with dashes", () => {
      expect(formatPhone("212-555-0100", "en-US")).toBe("(212) 555-0100");
    });

    it("should handle phone number with spaces", () => {
      expect(formatPhone("212 555 0100", "en-US")).toBe("(212) 555-0100");
    });

    it("should handle phone number with parentheses", () => {
      expect(formatPhone("(212) 555-0100", "en-US")).toBe("(212) 555-0100");
    });

    it("should handle phone number with dots", () => {
      expect(formatPhone("212.555.0100", "en-US")).toBe("(212) 555-0100");
    });

    it("should use en-US as default locale", () => {
      expect(formatPhone("2125550100")).toBe("(212) 555-0100");
    });
  });

  describe("en locale (generic English)", () => {
    it("should format US phone number with en locale", () => {
      expect(formatPhone("2125550100", "en")).toBe("(212) 555-0100");
    });
  });

  describe("non-US locales", () => {
    it("should return original format for de-DE locale", () => {
      expect(formatPhone("+49 30 12345678", "de-DE")).toBe("+49 30 12345678");
    });

    it("should return original format for zh-CN locale", () => {
      expect(formatPhone("+86 10 12345678", "zh-CN")).toBe("+86 10 12345678");
    });

    it("should return original format for ja-JP locale", () => {
      expect(formatPhone("+81 3 1234 5678", "ja-JP")).toBe("+81 3 1234 5678");
    });

    it("should return original format for en-GB locale", () => {
      expect(formatPhone("+44 20 7946 0958", "en-GB")).toBe("+44 20 7946 0958");
    });
  });

  describe("edge cases", () => {
    it("should return original for invalid US number (too short)", () => {
      expect(formatPhone("12345", "en-US")).toBe("12345");
    });

    it("should return original for invalid US number (too long)", () => {
      expect(formatPhone("123456789012345", "en-US")).toBe("123456789012345");
    });

    it("should handle empty string", () => {
      expect(formatPhone("", "en-US")).toBe("");
    });

    it("should handle number with letters", () => {
      // Letters are stripped, but if result doesn't match pattern, return original
      expect(formatPhone("212-555-HELP", "en-US")).toBe("212-555-HELP");
    });
  });
});

describe("formatPhoneInput", () => {
  describe("progressive formatting (en-US)", () => {
    it("should return empty string for empty input", () => {
      expect(formatPhoneInput("", "en-US")).toBe("");
    });

    it("should format 1 digit", () => {
      expect(formatPhoneInput("2", "en-US")).toBe("(2");
    });

    it("should format 2 digits", () => {
      expect(formatPhoneInput("21", "en-US")).toBe("(21");
    });

    it("should format 3 digits", () => {
      expect(formatPhoneInput("212", "en-US")).toBe("(212");
    });

    it("should format 4 digits", () => {
      expect(formatPhoneInput("2125", "en-US")).toBe("(212) 5");
    });

    it("should format 5 digits", () => {
      expect(formatPhoneInput("21255", "en-US")).toBe("(212) 55");
    });

    it("should format 6 digits", () => {
      expect(formatPhoneInput("212555", "en-US")).toBe("(212) 555");
    });

    it("should format 7 digits", () => {
      expect(formatPhoneInput("2125550", "en-US")).toBe("(212) 555-0");
    });

    it("should format 8 digits", () => {
      expect(formatPhoneInput("21255501", "en-US")).toBe("(212) 555-01");
    });

    it("should format 9 digits", () => {
      expect(formatPhoneInput("212555010", "en-US")).toBe("(212) 555-010");
    });

    it("should format 10 digits (complete)", () => {
      expect(formatPhoneInput("2125550100", "en-US")).toBe("(212) 555-0100");
    });
  });

  describe("input cleaning", () => {
    it("should strip non-digit characters", () => {
      expect(formatPhoneInput("(212) 555-0100", "en-US")).toBe("(212) 555-0100");
    });

    it("should handle input with spaces", () => {
      expect(formatPhoneInput("212 555 0100", "en-US")).toBe("(212) 555-0100");
    });

    it("should handle input with dashes", () => {
      expect(formatPhoneInput("212-555-0100", "en-US")).toBe("(212) 555-0100");
    });

    it("should handle input with dots", () => {
      expect(formatPhoneInput("212.555.0100", "en-US")).toBe("(212) 555-0100");
    });

    it("should limit to 10 digits", () => {
      expect(formatPhoneInput("21255501001234", "en-US")).toBe("(212) 555-0100");
    });

    it("should ignore letters", () => {
      expect(formatPhoneInput("212abc555def0100", "en-US")).toBe("(212) 555-0100");
    });
  });

  describe("deletion scenarios", () => {
    it("should handle deletion from complete number", () => {
      // User deletes last digit from (212) 555-0100
      expect(formatPhoneInput("(212) 555-010", "en-US")).toBe("(212) 555-010");
    });

    it("should handle deletion to 6 digits", () => {
      expect(formatPhoneInput("(212) 555", "en-US")).toBe("(212) 555");
    });

    it("should handle deletion to 3 digits", () => {
      expect(formatPhoneInput("(212", "en-US")).toBe("(212");
    });

    it("should handle deletion to empty", () => {
      expect(formatPhoneInput("(", "en-US")).toBe("");
    });
  });

  describe("non-US locales", () => {
    it("should return original value for de-DE locale", () => {
      expect(formatPhoneInput("12345", "de-DE")).toBe("12345");
    });

    it("should return original value for zh-CN locale", () => {
      expect(formatPhoneInput("12345", "zh-CN")).toBe("12345");
    });

    it("should return original value for en-GB locale", () => {
      expect(formatPhoneInput("12345", "en-GB")).toBe("12345");
    });
  });

  describe("en locale (generic English)", () => {
    it("should format with en locale", () => {
      expect(formatPhoneInput("2125550100", "en")).toBe("(212) 555-0100");
    });
  });

  describe("default locale", () => {
    it("should use en-US as default locale", () => {
      expect(formatPhoneInput("2125550100")).toBe("(212) 555-0100");
    });
  });
});
