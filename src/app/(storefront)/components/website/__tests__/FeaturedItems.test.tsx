import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FeaturedItems } from "../FeaturedItems";
import { MerchantProvider } from "@/contexts";
import type { FeaturedItem } from "@/types/website";
import type { ReactNode } from "react";

function createWrapper(currency: string, locale: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MerchantProvider config={{ currency, locale }}>
        {children}
      </MerchantProvider>
    );
  };
}

const mockItems: FeaturedItem[] = [
  {
    id: "1",
    name: "Classic Cheese Pizza",
    description: "Our signature pizza with fresh mozzarella",
    price: 18.99,
    image: "https://example.com/pizza.jpg",
    category: "Pizza",
  },
  {
    id: "2",
    name: "Pepperoni Pizza",
    description: "Classic pepperoni with premium mozzarella",
    price: 21.99,
    image: "https://example.com/pepperoni.jpg",
    category: "Pizza",
  },
];

describe("FeaturedItems", () => {
  describe("currency formatting", () => {
    it("should display prices in USD format", () => {
      render(<FeaturedItems items={mockItems} />, {
        wrapper: createWrapper("USD", "en-US"),
      });

      expect(screen.getByText("$18.99")).toBeInTheDocument();
      expect(screen.getByText("$21.99")).toBeInTheDocument();
    });

    it("should display prices in EUR format with de-DE locale", () => {
      const euroItems: FeaturedItem[] = [
        { ...mockItems[0], price: 100 },
        { ...mockItems[1], price: 200 },
      ];

      render(<FeaturedItems items={euroItems} />, {
        wrapper: createWrapper("EUR", "de-DE"),
      });

      // German format: comma as decimal separator, € after number
      expect(screen.getByText(/100,00.*€/)).toBeInTheDocument();
      expect(screen.getByText(/200,00.*€/)).toBeInTheDocument();
    });

    it("should display prices in CNY format", () => {
      const cnyItems: FeaturedItem[] = [
        { ...mockItems[0], price: 50 },
        { ...mockItems[1], price: 75 },
      ];

      render(<FeaturedItems items={cnyItems} />, {
        wrapper: createWrapper("CNY", "zh-CN"),
      });

      expect(screen.getByText(/¥50\.00/)).toBeInTheDocument();
      expect(screen.getByText(/¥75\.00/)).toBeInTheDocument();
    });

    it("should display prices in GBP format", () => {
      const gbpItems: FeaturedItem[] = [
        { ...mockItems[0], price: 15 },
        { ...mockItems[1], price: 20 },
      ];

      render(<FeaturedItems items={gbpItems} />, {
        wrapper: createWrapper("GBP", "en-GB"),
      });

      expect(screen.getByText("£15.00")).toBeInTheDocument();
      expect(screen.getByText("£20.00")).toBeInTheDocument();
    });

    it("should display prices in JPY format without decimals", () => {
      const jpyItems: FeaturedItem[] = [
        { ...mockItems[0], price: 1500 },
        { ...mockItems[1], price: 2000 },
      ];

      render(<FeaturedItems items={jpyItems} />, {
        wrapper: createWrapper("JPY", "ja-JP"),
      });

      expect(screen.getByText(/￥1,500/)).toBeInTheDocument();
      expect(screen.getByText(/￥2,000/)).toBeInTheDocument();
    });
  });

  describe("item display", () => {
    it("should display item names", () => {
      render(<FeaturedItems items={mockItems} />, {
        wrapper: createWrapper("USD", "en-US"),
      });

      expect(screen.getByText("Classic Cheese Pizza")).toBeInTheDocument();
      expect(screen.getByText("Pepperoni Pizza")).toBeInTheDocument();
    });

    it("should display item descriptions", () => {
      render(<FeaturedItems items={mockItems} />, {
        wrapper: createWrapper("USD", "en-US"),
      });

      expect(
        screen.getByText("Our signature pizza with fresh mozzarella")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Classic pepperoni with premium mozzarella")
      ).toBeInTheDocument();
    });

    it("should display item categories", () => {
      render(<FeaturedItems items={mockItems} />, {
        wrapper: createWrapper("USD", "en-US"),
      });

      // Both items have "Pizza" category
      const categories = screen.getAllByText("Pizza");
      expect(categories).toHaveLength(2);
    });

    it("should display Add buttons", () => {
      render(<FeaturedItems items={mockItems} />, {
        wrapper: createWrapper("USD", "en-US"),
      });

      const addButtons = screen.getAllByText("Add");
      expect(addButtons).toHaveLength(2);
    });

    it("should display section header", () => {
      render(<FeaturedItems items={mockItems} />, {
        wrapper: createWrapper("USD", "en-US"),
      });

      expect(screen.getByText("Featured Items")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Discover our most popular dishes, crafted with the finest ingredients"
        )
      ).toBeInTheDocument();
    });
  });
});
