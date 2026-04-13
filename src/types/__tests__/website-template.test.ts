import { describe, it, expect } from "vitest";
import { resolveTemplate, WEBSITE_TEMPLATES } from "../website-template";

describe("resolveTemplate", () => {
  it("returns fine_dining for fine_dining_restaurant primaryType", () => {
    expect(resolveTemplate("fine_dining_restaurant", [])).toBe("fine_dining");
  });
  it("returns fine_dining for steak_house primaryType", () => {
    expect(resolveTemplate("steak_house", [])).toBe("fine_dining");
  });
  it("returns fast_casual for fast_food_restaurant primaryType", () => {
    expect(resolveTemplate("fast_food_restaurant", [])).toBe("fast_casual");
  });
  it("returns fast_casual for pizza_restaurant primaryType", () => {
    expect(resolveTemplate("pizza_restaurant", [])).toBe("fast_casual");
  });
  it("returns cafe_bakery for cafe primaryType", () => {
    expect(resolveTemplate("cafe", [])).toBe("cafe_bakery");
  });
  it("returns cafe_bakery for bakery primaryType", () => {
    expect(resolveTemplate("bakery", [])).toBe("cafe_bakery");
  });
  it("returns bar_lounge for bar primaryType", () => {
    expect(resolveTemplate("bar", [])).toBe("bar_lounge");
  });
  it("returns bar_lounge for night_club primaryType", () => {
    expect(resolveTemplate("night_club", [])).toBe("bar_lounge");
  });
  it("falls back to types array when primaryType has no match", () => {
    expect(resolveTemplate("unknown_type", ["restaurant", "cafe"])).toBe(
      "cafe_bakery"
    );
  });
  it("returns casual as default when no type matches", () => {
    expect(resolveTemplate("unknown_type", ["food", "establishment"])).toBe(
      "casual"
    );
  });
  it("returns casual when both params are undefined", () => {
    expect(resolveTemplate(undefined, undefined)).toBe("casual");
  });
  it("prioritizes primaryType over types array", () => {
    expect(resolveTemplate("bar", ["cafe", "restaurant"])).toBe("bar_lounge");
  });
});

describe("WEBSITE_TEMPLATES", () => {
  it("contains all 5 template names", () => {
    expect(Object.keys(WEBSITE_TEMPLATES)).toHaveLength(5);
    expect(WEBSITE_TEMPLATES.fine_dining).toBe("fine_dining");
    expect(WEBSITE_TEMPLATES.casual).toBe("casual");
    expect(WEBSITE_TEMPLATES.fast_casual).toBe("fast_casual");
    expect(WEBSITE_TEMPLATES.cafe_bakery).toBe("cafe_bakery");
    expect(WEBSITE_TEMPLATES.bar_lounge).toBe("bar_lounge");
  });
});
