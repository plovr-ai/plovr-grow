import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "../button";

describe("Button", () => {
  it("should render as Slot when asChild is true", () => {
    render(
      <Button asChild>
        <span data-href="/test">Link Button</span>
      </Button>
    );

    const el = screen.getByText("Link Button");
    expect(el).toHaveAttribute("data-href", "/test");
    expect(el).toHaveAttribute("data-slot", "button");
  });
});
