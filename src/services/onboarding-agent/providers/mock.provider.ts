/**
 * Mock AI Provider
 *
 * Returns mock data for testing and development without API calls.
 */

import type {
  AIExtractionResult,
  ExtractionSchema,
  ExtractedRestaurantInfo,
  ExtractedMenuCategory,
} from "../onboarding-agent.types";
import type { AIProvider } from "./ai-provider.interface";

export class MockAIProvider implements AIProvider {
  getProviderName(): string {
    return "mock";
  }

  isConfigured(): boolean {
    return true;
  }

  async extractStructuredData<T>(
    content: string,
    schema: ExtractionSchema,
    _instructions: string
  ): Promise<AIExtractionResult<T>> {
    // Simulate API delay
    await this.delay(500);

    if (schema.type === "restaurant_info") {
      return {
        success: true,
        data: this.getMockRestaurantInfo() as T,
        tokensUsed: 1000,
        model: "mock",
      };
    }

    if (schema.type === "menu") {
      return {
        success: true,
        data: { categories: this.getMockMenuCategories() } as T,
        tokensUsed: 2000,
        model: "mock",
      };
    }

    return {
      success: false,
      error: `Unknown schema type: ${schema.type}`,
    };
  }

  async extractRestaurantInfo(
    _content: string,
    _sourceType: string
  ): Promise<AIExtractionResult<ExtractedRestaurantInfo>> {
    await this.delay(500);
    return {
      success: true,
      data: this.getMockRestaurantInfo(),
      tokensUsed: 1000,
      model: "mock",
    };
  }

  async extractMenu(
    _content: string,
    _sourceType: string
  ): Promise<AIExtractionResult<{ categories: ExtractedMenuCategory[] }>> {
    await this.delay(500);
    return {
      success: true,
      data: { categories: this.getMockMenuCategories() },
      tokensUsed: 2000,
      model: "mock",
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getMockRestaurantInfo(): ExtractedRestaurantInfo {
    return {
      name: "Mock Restaurant",
      description:
        "A delicious mock restaurant with amazing food and great atmosphere.",
      tagline: "Fresh food, made with love",
      address: "123 Main Street",
      city: "San Francisco",
      state: "CA",
      zipCode: "94102",
      phone: "(415) 555-1234",
      email: "info@mockrestaurant.com",
      logoUrl: "https://example.com/logo.png",
      heroImageUrl: "https://example.com/hero.jpg",
      businessHours: {
        monday: { open: "09:00", close: "21:00" },
        tuesday: { open: "09:00", close: "21:00" },
        wednesday: { open: "09:00", close: "21:00" },
        thursday: { open: "09:00", close: "21:00" },
        friday: { open: "09:00", close: "22:00" },
        saturday: { open: "10:00", close: "22:00" },
        sunday: { open: "10:00", close: "20:00" },
      },
      socialLinks: [
        { platform: "instagram", url: "https://instagram.com/mockrestaurant" },
        { platform: "facebook", url: "https://facebook.com/mockrestaurant" },
      ],
      rating: 4.5,
      reviewCount: 150,
    };
  }

  private getMockMenuCategories(): ExtractedMenuCategory[] {
    return [
      {
        name: "Appetizers",
        description: "Start your meal with our delicious starters",
        items: [
          {
            name: "Spring Rolls",
            description: "Crispy vegetable spring rolls with dipping sauce",
            price: 8.99,
            imageUrl: "https://example.com/spring-rolls.jpg",
            tags: ["vegetarian"],
          },
          {
            name: "Chicken Wings",
            description: "Crispy fried wings with your choice of sauce",
            price: 12.99,
            imageUrl: "https://example.com/wings.jpg",
            modifiers: [
              {
                name: "Sauce",
                type: "single",
                required: true,
                options: [
                  { name: "Buffalo", price: 0 },
                  { name: "BBQ", price: 0 },
                  { name: "Honey Garlic", price: 0 },
                ],
              },
            ],
          },
        ],
      },
      {
        name: "Main Courses",
        description: "Our signature dishes",
        items: [
          {
            name: "Grilled Salmon",
            description:
              "Fresh Atlantic salmon with seasonal vegetables and rice",
            price: 24.99,
            imageUrl: "https://example.com/salmon.jpg",
            tags: ["gluten-free"],
          },
          {
            name: "Chicken Parmesan",
            description: "Breaded chicken breast with marinara and mozzarella",
            price: 18.99,
            imageUrl: "https://example.com/chicken-parm.jpg",
          },
          {
            name: "Vegetable Stir Fry",
            description: "Mixed vegetables in garlic sauce with steamed rice",
            price: 14.99,
            imageUrl: "https://example.com/stirfry.jpg",
            tags: ["vegetarian", "vegan"],
          },
        ],
      },
      {
        name: "Desserts",
        description: "Sweet endings",
        items: [
          {
            name: "Chocolate Cake",
            description: "Rich chocolate cake with chocolate ganache",
            price: 7.99,
            imageUrl: "https://example.com/cake.jpg",
          },
          {
            name: "Ice Cream Sundae",
            description: "Three scoops with your choice of toppings",
            price: 6.99,
            modifiers: [
              {
                name: "Flavor",
                type: "multiple",
                required: true,
                options: [
                  { name: "Vanilla", price: 0 },
                  { name: "Chocolate", price: 0 },
                  { name: "Strawberry", price: 0 },
                ],
              },
              {
                name: "Toppings",
                type: "multiple",
                required: false,
                options: [
                  { name: "Whipped Cream", price: 0.5 },
                  { name: "Hot Fudge", price: 1.0 },
                  { name: "Sprinkles", price: 0.5 },
                ],
              },
            ],
          },
        ],
      },
    ];
  }
}
