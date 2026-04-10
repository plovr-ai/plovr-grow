import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CheckoutPageLayout } from "../CheckoutPageLayout";

describe("CheckoutPageLayout", () => {
  it("should render children, summary, and mobile footer", () => {
    render(
      <CheckoutPageLayout
        summary={<div>Summary Content</div>}
        mobileFooter={<div>Mobile Footer</div>}
      >
        <div>Main Content</div>
      </CheckoutPageLayout>
    );

    expect(screen.getByText("Main Content")).toBeInTheDocument();
    expect(screen.getByText("Summary Content")).toBeInTheDocument();
    expect(screen.getByText("Mobile Footer")).toBeInTheDocument();
  });

  it("should apply default mobilePadding class (pb-40)", () => {
    const { container } = render(
      <CheckoutPageLayout
        summary={<div>Summary</div>}
        mobileFooter={<div>Footer</div>}
      >
        <div>Content</div>
      </CheckoutPageLayout>
    );

    const leftColumn = container.querySelector(".lg\\:col-span-2");
    expect(leftColumn).toHaveClass("pb-40");
  });

  it("should apply custom mobilePadding class", () => {
    const { container } = render(
      <CheckoutPageLayout
        summary={<div>Summary</div>}
        mobileFooter={<div>Footer</div>}
        mobilePadding="pb-60"
      >
        <div>Content</div>
      </CheckoutPageLayout>
    );

    const leftColumn = container.querySelector(".lg\\:col-span-2");
    expect(leftColumn).toHaveClass("pb-60");
  });

  it("should have responsive grid layout", () => {
    const { container } = render(
      <CheckoutPageLayout
        summary={<div>Summary</div>}
        mobileFooter={<div>Footer</div>}
      >
        <div>Content</div>
      </CheckoutPageLayout>
    );

    expect(container.querySelector(".lg\\:grid.lg\\:grid-cols-3")).toBeInTheDocument();
    expect(container.querySelector(".hidden.lg\\:block")).toBeInTheDocument();
    expect(container.querySelector(".lg\\:hidden.fixed.bottom-0")).toBeInTheDocument();
  });
});
