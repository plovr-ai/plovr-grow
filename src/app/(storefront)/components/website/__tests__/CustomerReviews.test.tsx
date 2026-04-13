import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CustomerReviews } from "../CustomerReviews";
import { MerchantProvider } from "@/contexts/MerchantContext";
import type { CustomerReview } from "@/types/website";

const renderWithProvider = (ui: React.ReactElement) => {
  return render(
    <MerchantProvider config={{ name: "Test Restaurant", logoUrl: null, currency: "USD", locale: "en-US", timezone: "America/New_York" }}>
      {ui}
    </MerchantProvider>
  );
};

const makeReview = (overrides: Partial<CustomerReview> = {}): CustomerReview => ({
  id: "review-1",
  customerName: "Jane Doe",
  rating: 5,
  content: "Amazing food and great service!",
  date: "2025-06-15",
  source: "google",
  ...overrides,
});

describe("CustomerReviews", () => {
  it("should return null when reviews array is empty", () => {
    const { container } = renderWithProvider(<CustomerReviews reviews={[]} />);

    expect(container.innerHTML).toBe("");
  });

  it("should render review content and customer name", () => {
    const review = makeReview({
      customerName: "Alice Smith",
      content: "Best pizza in town!",
    });

    renderWithProvider(<CustomerReviews reviews={[review]} />);

    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    expect(screen.getByText(/Best pizza in town!/)).toBeInTheDocument();
  });

  it("should render customer initial in avatar", () => {
    const review = makeReview({ customerName: "John" });

    renderWithProvider(<CustomerReviews reviews={[review]} />);

    expect(screen.getByText("J")).toBeInTheDocument();
  });

  it("should handle empty customerName gracefully", () => {
    const review = makeReview({ customerName: "" });

    renderWithProvider(<CustomerReviews reviews={[review]} />);

    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("should render star ratings", () => {
    const review = makeReview({ rating: 4 });

    renderWithProvider(<CustomerReviews reviews={[review]} />);

    const stars = document.querySelectorAll("svg.w-5.h-5");
    // 5 star SVGs + 1 source icon SVG
    const starSvgs = Array.from(stars).filter((svg) => {
      const classes = svg.className.baseVal || svg.getAttribute("class") || "";
      return classes.includes("text-yellow-400") || classes.includes("text-gray-300");
    });
    expect(starSvgs).toHaveLength(5);

    const filledStars = starSvgs.filter((svg) => {
      const classes = svg.className.baseVal || svg.getAttribute("class") || "";
      return classes.includes("text-yellow-400");
    });
    const emptyStars = starSvgs.filter((svg) => {
      const classes = svg.className.baseVal || svg.getAttribute("class") || "";
      return classes.includes("text-gray-300");
    });
    expect(filledStars).toHaveLength(4);
    expect(emptyStars).toHaveLength(1);
  });

  it("should render multiple reviews", () => {
    const reviews = [
      makeReview({ id: "r1", customerName: "Alice" }),
      makeReview({ id: "r2", customerName: "Bob" }),
      makeReview({ id: "r3", customerName: "Charlie" }),
    ];

    renderWithProvider(<CustomerReviews reviews={reviews} />);

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Charlie")).toBeInTheDocument();
  });

  it("should render yelp source icon", () => {
    const review = makeReview({ source: "yelp" });

    const { container } = renderWithProvider(<CustomerReviews reviews={[review]} />);

    const yelpIcon = container.querySelector("svg.text-red-500");
    expect(yelpIcon).toBeInTheDocument();
  });

  it("should render default source icon for unknown sources", () => {
    const review = makeReview({ source: "unknown" as CustomerReview["source"] });

    const { container } = renderWithProvider(<CustomerReviews reviews={[review]} />);

    const defaultIcon = container.querySelector("svg.text-gray-400");
    expect(defaultIcon).toBeInTheDocument();
  });
});
