import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  ArrowLeftIcon,
  CartIcon,
  ImagePlaceholderIcon,
  TrashIcon,
  MinusIcon,
  PlusIcon,
} from "../index";

describe("Icon Components", () => {
  describe("ArrowLeftIcon", () => {
    it("should render an SVG element", () => {
      const { container } = render(<ArrowLeftIcon />);
      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("should apply custom className", () => {
      const { container } = render(<ArrowLeftIcon className="w-5 h-5 text-red-500" />);
      const svg = container.querySelector("svg");
      expect(svg).toHaveClass("w-5", "h-5", "text-red-500");
    });

    it("should pass through additional props", () => {
      const { container } = render(<ArrowLeftIcon data-testid="arrow-icon" />);
      const svg = container.querySelector('[data-testid="arrow-icon"]');
      expect(svg).toBeInTheDocument();
    });
  });

  describe("CartIcon", () => {
    it("should render an SVG element", () => {
      const { container } = render(<CartIcon />);
      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("should apply custom className", () => {
      const { container } = render(<CartIcon className="w-16 h-16" />);
      const svg = container.querySelector("svg");
      expect(svg).toHaveClass("w-16", "h-16");
    });
  });

  describe("ImagePlaceholderIcon", () => {
    it("should render an SVG element", () => {
      const { container } = render(<ImagePlaceholderIcon />);
      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("should apply custom className", () => {
      const { container } = render(<ImagePlaceholderIcon className="w-8 h-8 text-gray-300" />);
      const svg = container.querySelector("svg");
      expect(svg).toHaveClass("w-8", "h-8", "text-gray-300");
    });
  });

  describe("TrashIcon", () => {
    it("should render an SVG element", () => {
      const { container } = render(<TrashIcon />);
      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("should apply custom className", () => {
      const { container } = render(<TrashIcon className="w-4 h-4 text-red-500" />);
      const svg = container.querySelector("svg");
      expect(svg).toHaveClass("w-4", "h-4", "text-red-500");
    });
  });

  describe("MinusIcon", () => {
    it("should render an SVG element", () => {
      const { container } = render(<MinusIcon />);
      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("should apply custom className", () => {
      const { container } = render(<MinusIcon className="w-4 h-4" />);
      const svg = container.querySelector("svg");
      expect(svg).toHaveClass("w-4", "h-4");
    });
  });

  describe("PlusIcon", () => {
    it("should render an SVG element", () => {
      const { container } = render(<PlusIcon />);
      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("should apply custom className", () => {
      const { container } = render(<PlusIcon className="w-5 h-5" />);
      const svg = container.querySelector("svg");
      expect(svg).toHaveClass("w-5", "h-5");
    });
  });

  describe("SVG attributes", () => {
    it("all icons should have fill=none and stroke=currentColor", () => {
      const icons = [
        <ArrowLeftIcon key="arrow" />,
        <CartIcon key="cart" />,
        <ImagePlaceholderIcon key="image" />,
        <TrashIcon key="trash" />,
        <MinusIcon key="minus" />,
        <PlusIcon key="plus" />,
      ];

      icons.forEach((icon) => {
        const { container } = render(icon);
        const svg = container.querySelector("svg");
        expect(svg).toHaveAttribute("fill", "none");
        expect(svg).toHaveAttribute("stroke", "currentColor");
      });
    });

    it("all icons should have viewBox attribute", () => {
      const icons = [
        <ArrowLeftIcon key="arrow" />,
        <CartIcon key="cart" />,
        <ImagePlaceholderIcon key="image" />,
        <TrashIcon key="trash" />,
        <MinusIcon key="minus" />,
        <PlusIcon key="plus" />,
      ];

      icons.forEach((icon) => {
        const { container } = render(icon);
        const svg = container.querySelector("svg");
        expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
      });
    });
  });
});
