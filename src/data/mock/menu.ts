import type { MenuPageViewModel } from "@/types/menu-page";

export const mockMenuPageData: MenuPageViewModel = {
  merchantName: "Joe's Pizza",
  merchantLogo:
    "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=200&h=200&fit=crop",
  currency: "USD",
  locale: "en-US",
  categories: [
    {
      category: {
        id: "featured",
        name: "Featured",
        description: "Our most popular dishes",
        itemCount: 4,
      },
      items: [
        {
          id: "item-1",
          name: "Classic Cheese Pizza",
          description:
            "Our signature pizza with fresh mozzarella and house-made tomato sauce",
          price: 18.99,
          imageUrl:
            "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=300&fit=crop",
          tags: ["popular"],
          hasOptions: true,
          isAvailable: true,
        },
        {
          id: "item-2",
          name: "Pepperoni Pizza",
          description: "Classic pepperoni with premium mozzarella cheese",
          price: 21.99,
          imageUrl:
            "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=400&h=300&fit=crop",
          tags: ["popular"],
          hasOptions: true,
          isAvailable: true,
        },
        {
          id: "item-3",
          name: "Margherita Pizza",
          description: "Fresh tomatoes, mozzarella, basil, and olive oil",
          price: 19.99,
          imageUrl:
            "https://images.unsplash.com/photo-1604068549290-dea0e4a305ca?w=400&h=300&fit=crop",
          tags: ["vegetarian"],
          hasOptions: true,
          isAvailable: true,
        },
        {
          id: "item-8",
          name: "Garlic Knots",
          description: "Fresh baked knots with garlic butter (6 pieces)",
          price: 5.99,
          imageUrl:
            "https://images.unsplash.com/photo-1619531040576-f9416740661b?w=400&h=300&fit=crop",
          tags: ["vegetarian", "popular"],
          hasOptions: false,
          isAvailable: true,
        },
      ],
    },
    {
      category: {
        id: "cat-pizza",
        name: "Pizza",
        description: "Our handcrafted New York style pizzas",
        itemCount: 4,
      },
      items: [
        {
          id: "item-1",
          name: "Classic Cheese Pizza",
          description:
            "Our signature pizza with fresh mozzarella and house-made tomato sauce",
          price: 18.99,
          imageUrl:
            "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=300&fit=crop",
          tags: ["popular"],
          hasOptions: true,
          isAvailable: true,
        },
        {
          id: "item-2",
          name: "Pepperoni Pizza",
          description: "Classic pepperoni with premium mozzarella cheese",
          price: 21.99,
          imageUrl:
            "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=400&h=300&fit=crop",
          tags: ["popular"],
          hasOptions: true,
          isAvailable: true,
        },
        {
          id: "item-3",
          name: "Margherita Pizza",
          description: "Fresh tomatoes, mozzarella, basil, and olive oil",
          price: 19.99,
          imageUrl:
            "https://images.unsplash.com/photo-1604068549290-dea0e4a305ca?w=400&h=300&fit=crop",
          tags: ["vegetarian"],
          hasOptions: true,
          isAvailable: true,
        },
        {
          id: "item-4",
          name: "Supreme Pizza",
          description: "Pepperoni, sausage, peppers, onions, and mushrooms",
          price: 24.99,
          imageUrl:
            "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop",
          tags: [],
          hasOptions: true,
          isAvailable: true,
        },
      ],
    },
    {
      category: {
        id: "cat-pasta",
        name: "Pasta",
        description: "Homemade pasta dishes",
        itemCount: 3,
      },
      items: [
        {
          id: "item-5",
          name: "Spaghetti & Meatballs",
          description:
            "Classic spaghetti with house-made meatballs and marinara sauce",
          price: 16.99,
          imageUrl:
            "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=400&h=300&fit=crop",
          tags: [],
          hasOptions: false,
          isAvailable: true,
        },
        {
          id: "item-6",
          name: "Fettuccine Alfredo",
          description: "Creamy parmesan alfredo sauce over fettuccine",
          price: 15.99,
          imageUrl:
            "https://images.unsplash.com/photo-1645112411341-6c4fd023714a?w=400&h=300&fit=crop",
          tags: ["vegetarian"],
          hasOptions: true,
          isAvailable: true,
        },
        {
          id: "item-7",
          name: "Baked Ziti",
          description:
            "Ziti pasta baked with ricotta, mozzarella, and marinara",
          price: 14.99,
          imageUrl:
            "https://images.unsplash.com/photo-1629115916087-7e8c114a24ed?w=400&h=300&fit=crop",
          tags: ["vegetarian"],
          hasOptions: false,
          isAvailable: true,
        },
      ],
    },
    {
      category: {
        id: "cat-sides",
        name: "Sides",
        description: "Perfect additions to your meal",
        itemCount: 3,
      },
      items: [
        {
          id: "item-8",
          name: "Garlic Knots",
          description: "Fresh baked knots with garlic butter (6 pieces)",
          price: 5.99,
          imageUrl:
            "https://images.unsplash.com/photo-1619531040576-f9416740661b?w=400&h=300&fit=crop",
          tags: ["vegetarian", "popular"],
          hasOptions: false,
          isAvailable: true,
        },
        {
          id: "item-9",
          name: "Caesar Salad",
          description:
            "Crisp romaine, parmesan, croutons, and caesar dressing",
          price: 8.99,
          imageUrl:
            "https://images.unsplash.com/photo-1550304943-4f24f54ddde9?w=400&h=300&fit=crop",
          tags: ["vegetarian"],
          hasOptions: true,
          isAvailable: true,
        },
        {
          id: "item-10",
          name: "Mozzarella Sticks",
          description:
            "Crispy fried mozzarella served with marinara (6 pieces)",
          price: 7.99,
          imageUrl:
            "https://images.unsplash.com/photo-1531749668029-2db88e4276c7?w=400&h=300&fit=crop",
          tags: ["vegetarian"],
          hasOptions: false,
          isAvailable: true,
        },
      ],
    },
    {
      category: {
        id: "cat-beverages",
        name: "Beverages",
        description: "Refreshing drinks",
        itemCount: 2,
      },
      items: [
        {
          id: "item-11",
          name: "Fountain Drink",
          description: "Coca-Cola, Sprite, Fanta, or Lemonade",
          price: 2.99,
          imageUrl: null,
          tags: [],
          hasOptions: true,
          isAvailable: true,
        },
        {
          id: "item-12",
          name: "Italian Soda",
          description: "Sparkling water with your choice of flavor",
          price: 3.99,
          imageUrl: null,
          tags: [],
          hasOptions: true,
          isAvailable: true,
        },
      ],
    },
  ],
};

export function getMockMenuPageData(slug: string): MenuPageViewModel {
  // 未来可根据 slug 返回不同的菜单数据
  return mockMenuPageData;
}
