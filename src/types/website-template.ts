export const WEBSITE_TEMPLATES = {
  fine_dining: "fine_dining",
  casual: "casual",
  fast_casual: "fast_casual",
  cafe_bakery: "cafe_bakery",
  bar_lounge: "bar_lounge",
} as const;

export type WebsiteTemplateName =
  (typeof WEBSITE_TEMPLATES)[keyof typeof WEBSITE_TEMPLATES];

const TYPE_TO_TEMPLATE: Record<string, WebsiteTemplateName> = {
  fine_dining_restaurant: "fine_dining",
  steak_house: "fine_dining",
  fast_food_restaurant: "fast_casual",
  meal_takeaway: "fast_casual",
  pizza_restaurant: "fast_casual",
  sandwich_shop: "fast_casual",
  cafe: "cafe_bakery",
  bakery: "cafe_bakery",
  coffee_shop: "cafe_bakery",
  ice_cream_shop: "cafe_bakery",
  bar: "bar_lounge",
  night_club: "bar_lounge",
  wine_bar: "bar_lounge",
};

export function resolveTemplate(
  primaryType?: string,
  types?: string[]
): WebsiteTemplateName {
  if (primaryType && TYPE_TO_TEMPLATE[primaryType]) {
    return TYPE_TO_TEMPLATE[primaryType];
  }
  if (types) {
    for (const type of types) {
      if (TYPE_TO_TEMPLATE[type]) {
        return TYPE_TO_TEMPLATE[type];
      }
    }
  }
  return "casual";
}
