/**
 * Menu API Mock Data
 * 用于 getMenu API 的 mock 数据
 */

import type {
  MenuApiResponse,
  Menu,
  MenuItem,
  ModifierGroup,
} from "@/services/menu/menu-api.types";

// ==================== Modifier Groups ====================

const pizzaSizeModifier: ModifierGroup = {
  id: "mod-pizza-size",
  name: "Size",
  type: "single",
  required: true,
  modifiers: [
    { id: "size-small", name: "Small 10\"", price: 0 },
    { id: "size-medium", name: "Medium 14\"", price: 4 },
    { id: "size-large", name: "Large 18\"", price: 8 },
  ],
};

const pizzaToppingsModifier: ModifierGroup = {
  id: "mod-pizza-toppings",
  name: "Extra Toppings",
  type: "multiple",
  required: false,
  modifiers: [
    { id: "topping-mushrooms", name: "Mushrooms", price: 1.5 },
    { id: "topping-olives", name: "Olives", price: 1.5 },
    { id: "topping-peppers", name: "Bell Peppers", price: 1.5 },
    { id: "topping-onions", name: "Onions", price: 1 },
    { id: "topping-extra-cheese", name: "Extra Cheese", price: 2 },
  ],
};

const pastaAddProteinModifier: ModifierGroup = {
  id: "mod-pasta-protein",
  name: "Add Protein",
  type: "single",
  required: false,
  modifiers: [
    { id: "protein-none", name: "No Protein", price: 0 },
    { id: "protein-chicken", name: "Grilled Chicken", price: 4 },
    { id: "protein-shrimp", name: "Shrimp", price: 6 },
  ],
};

const saladDressingModifier: ModifierGroup = {
  id: "mod-salad-dressing",
  name: "Dressing",
  type: "single",
  required: true,
  modifiers: [
    { id: "dressing-caesar", name: "Caesar", price: 0 },
    { id: "dressing-ranch", name: "Ranch", price: 0 },
    { id: "dressing-italian", name: "Italian", price: 0 },
    { id: "dressing-balsamic", name: "Balsamic Vinaigrette", price: 0 },
  ],
};

const drinkSizeModifier: ModifierGroup = {
  id: "mod-drink-size",
  name: "Size",
  type: "single",
  required: true,
  modifiers: [
    { id: "drink-small", name: "Small", price: 0 },
    { id: "drink-medium", name: "Medium", price: 0.5 },
    { id: "drink-large", name: "Large", price: 1 },
  ],
};

const drinkFlavorModifier: ModifierGroup = {
  id: "mod-drink-flavor",
  name: "Flavor",
  type: "single",
  required: true,
  modifiers: [
    { id: "flavor-cola", name: "Coca-Cola", price: 0 },
    { id: "flavor-sprite", name: "Sprite", price: 0 },
    { id: "flavor-fanta", name: "Fanta", price: 0 },
    { id: "flavor-lemonade", name: "Lemonade", price: 0 },
  ],
};

const italianSodaFlavorModifier: ModifierGroup = {
  id: "mod-italian-soda-flavor",
  name: "Flavor",
  type: "single",
  required: true,
  modifiers: [
    { id: "flavor-raspberry", name: "Raspberry", price: 0 },
    { id: "flavor-peach", name: "Peach", price: 0 },
    { id: "flavor-strawberry", name: "Strawberry", price: 0 },
    { id: "flavor-vanilla", name: "Vanilla", price: 0 },
  ],
};

// ==================== Menu Items ====================

const mockItems: Record<string, MenuItem> = {
  "item-1": {
    id: "item-1",
    name: "Classic Cheese Pizza",
    description:
      "Our signature pizza with fresh mozzarella and house-made tomato sauce",
    price: 18.99,
    imageUrl:
      "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=300&fit=crop",
    tags: ["popular"],
    isAvailable: true,
    taxConfigId: "tax-standard",
    modifierGroups: [pizzaSizeModifier, pizzaToppingsModifier],
  },
  "item-2": {
    id: "item-2",
    name: "Pepperoni Pizza",
    description: "Classic pepperoni with premium mozzarella cheese",
    price: 21.99,
    imageUrl:
      "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=400&h=300&fit=crop",
    tags: ["popular"],
    isAvailable: true,
    taxConfigId: "tax-standard",
    modifierGroups: [pizzaSizeModifier, pizzaToppingsModifier],
  },
  "item-3": {
    id: "item-3",
    name: "Margherita Pizza",
    description: "Fresh tomatoes, mozzarella, basil, and olive oil",
    price: 19.99,
    imageUrl:
      "https://images.unsplash.com/photo-1604068549290-dea0e4a305ca?w=400&h=300&fit=crop",
    tags: ["vegetarian"],
    isAvailable: true,
    taxConfigId: "tax-standard",
    modifierGroups: [pizzaSizeModifier, pizzaToppingsModifier],
  },
  "item-4": {
    id: "item-4",
    name: "Supreme Pizza",
    description: "Pepperoni, sausage, peppers, onions, and mushrooms",
    price: 24.99,
    imageUrl:
      "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop",
    tags: [],
    isAvailable: true,
    taxConfigId: "tax-standard",
    modifierGroups: [pizzaSizeModifier, pizzaToppingsModifier],
  },
  "item-5": {
    id: "item-5",
    name: "Spaghetti & Meatballs",
    description:
      "Classic spaghetti with house-made meatballs and marinara sauce",
    price: 16.99,
    imageUrl:
      "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=400&h=300&fit=crop",
    tags: [],
    isAvailable: true,
    taxConfigId: "tax-standard",
    modifierGroups: null,
  },
  "item-6": {
    id: "item-6",
    name: "Fettuccine Alfredo",
    description: "Creamy parmesan alfredo sauce over fettuccine",
    price: 15.99,
    imageUrl:
      "https://images.unsplash.com/photo-1645112411341-6c4fd023714a?w=400&h=300&fit=crop",
    tags: ["vegetarian"],
    isAvailable: true,
    taxConfigId: "tax-standard",
    modifierGroups: [pastaAddProteinModifier],
  },
  "item-7": {
    id: "item-7",
    name: "Baked Ziti",
    description: "Ziti pasta baked with ricotta, mozzarella, and marinara",
    price: 14.99,
    imageUrl:
      "https://images.unsplash.com/photo-1629115916087-7e8c114a24ed?w=400&h=300&fit=crop",
    tags: ["vegetarian"],
    isAvailable: true,
    taxConfigId: "tax-standard",
    modifierGroups: null,
  },
  "item-8": {
    id: "item-8",
    name: "Garlic Knots",
    description: "Fresh baked knots with garlic butter (6 pieces)",
    price: 5.99,
    imageUrl:
      "https://images.unsplash.com/photo-1619531040576-f9416740661b?w=400&h=300&fit=crop",
    tags: ["vegetarian", "popular"],
    isAvailable: true,
    taxConfigId: "tax-standard",
    modifierGroups: null,
  },
  "item-9": {
    id: "item-9",
    name: "Caesar Salad",
    description: "Crisp romaine, parmesan, croutons, and caesar dressing",
    price: 8.99,
    imageUrl:
      "https://images.unsplash.com/photo-1550304943-4f24f54ddde9?w=400&h=300&fit=crop",
    tags: ["vegetarian"],
    isAvailable: true,
    taxConfigId: "tax-standard",
    modifierGroups: [saladDressingModifier],
  },
  "item-10": {
    id: "item-10",
    name: "Mozzarella Sticks",
    description: "Crispy fried mozzarella served with marinara (6 pieces)",
    price: 7.99,
    imageUrl:
      "https://images.unsplash.com/photo-1531749668029-2db88e4276c7?w=400&h=300&fit=crop",
    tags: ["vegetarian"],
    isAvailable: true,
    taxConfigId: "tax-standard",
    modifierGroups: null,
  },
  "item-11": {
    id: "item-11",
    name: "Fountain Drink",
    description: "Coca-Cola, Sprite, Fanta, or Lemonade",
    price: 2.99,
    imageUrl: null,
    tags: [],
    isAvailable: true,
    taxConfigId: "tax-reduced",
    modifierGroups: [drinkSizeModifier, drinkFlavorModifier],
  },
  "item-12": {
    id: "item-12",
    name: "Italian Soda",
    description: "Sparkling water with your choice of flavor",
    price: 3.99,
    imageUrl: null,
    tags: [],
    isAvailable: true,
    taxConfigId: "tax-reduced",
    modifierGroups: [italianSodaFlavorModifier],
  },
};

// ==================== Menu ====================

const mockMenu: Menu = {
  id: "menu-joes-pizza",
  merchantId: "merchant-1",
  merchantName: "Joe's Pizza",
  currency: "USD",
  locale: "en-US",
  categories: [
    {
      id: "featured",
      name: "Featured",
      description: "Our most popular dishes",
      sortOrder: 0,
      itemIds: ["item-1", "item-2", "item-3", "item-8"],
    },
    {
      id: "cat-pizza",
      name: "Pizza",
      description: "Our handcrafted New York style pizzas",
      sortOrder: 1,
      itemIds: ["item-1", "item-2", "item-3", "item-4"],
    },
    {
      id: "cat-pasta",
      name: "Pasta",
      description: "Homemade pasta dishes",
      sortOrder: 2,
      itemIds: ["item-5", "item-6", "item-7"],
    },
    {
      id: "cat-sides",
      name: "Sides",
      description: "Perfect additions to your meal",
      sortOrder: 3,
      itemIds: ["item-8", "item-9", "item-10"],
    },
    {
      id: "cat-beverages",
      name: "Beverages",
      description: "Refreshing drinks",
      sortOrder: 4,
      itemIds: ["item-11", "item-12"],
    },
  ],
};

// ==================== Mock Response ====================

const mockMenuResponse: MenuApiResponse = {
  menu: mockMenu,
  items: mockItems,
};

/**
 * 获取 mock 菜单响应
 * @param tenantId 租户 ID
 * @param merchantId 商家 ID
 * @returns MenuApiResponse
 */
export function getMockMenuResponse(
  tenantId: string,
  merchantId: string
): MenuApiResponse {
  // 未来可根据 tenantId 和 merchantId 返回不同的菜单数据
  return mockMenuResponse;
}
