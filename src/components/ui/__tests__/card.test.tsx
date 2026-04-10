import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../card";

describe("Card components", () => {
  it("should render CardDescription with correct data-slot", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
          <CardDescription>Description text</CardDescription>
        </CardHeader>
      </Card>
    );

    const desc = screen.getByText("Description text");
    expect(desc).toHaveAttribute("data-slot", "card-description");
  });

  it("should render CardFooter with correct data-slot", () => {
    render(
      <Card>
        <CardContent>Content</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>
    );

    const footer = screen.getByText("Footer");
    expect(footer).toHaveAttribute("data-slot", "card-footer");
  });
});
