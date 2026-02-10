import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  PaymentStatusBadge,
  FulfillmentStatusBadge,
  StatusBadge,
} from "../StatusBadge";
import type { OrderStatus, FulfillmentStatus } from "@/types";

describe("PaymentStatusBadge", () => {
  const paymentStatuses: { status: OrderStatus; label: string; colorClass: string }[] = [
    { status: "created", label: "Unpaid", colorClass: "bg-yellow-100" },
    { status: "partial_paid", label: "Partial Paid", colorClass: "bg-orange-100" },
    { status: "completed", label: "Paid", colorClass: "bg-green-100" },
    { status: "canceled", label: "Cancelled", colorClass: "bg-red-100" },
  ];

  paymentStatuses.forEach(({ status, label, colorClass }) => {
    it(`should render "${label}" for status "${status}"`, () => {
      render(<PaymentStatusBadge status={status} />);

      const badge = screen.getByText(label);
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass(colorClass);
    });
  });

  it("should apply custom className", () => {
    render(<PaymentStatusBadge status="completed" className="custom-class" />);

    const badge = screen.getByText("Paid");
    expect(badge).toHaveClass("custom-class");
  });

  it("should have common badge styling classes", () => {
    render(<PaymentStatusBadge status="created" />);

    const badge = screen.getByText("Unpaid");
    expect(badge).toHaveClass("inline-flex");
    expect(badge).toHaveClass("items-center");
    expect(badge).toHaveClass("rounded-full");
    expect(badge).toHaveClass("border");
    expect(badge).toHaveClass("text-xs");
    expect(badge).toHaveClass("font-semibold");
  });
});

describe("FulfillmentStatusBadge", () => {
  const fulfillmentStatuses: { status: FulfillmentStatus; label: string; colorClass: string }[] = [
    { status: "pending", label: "Pending", colorClass: "bg-gray-100" },
    { status: "confirmed", label: "Confirmed", colorClass: "bg-blue-100" },
    { status: "preparing", label: "Preparing", colorClass: "bg-purple-100" },
    { status: "ready", label: "Ready", colorClass: "bg-green-100" },
    { status: "fulfilled", label: "Fulfilled", colorClass: "bg-gray-100" },
  ];

  fulfillmentStatuses.forEach(({ status, label, colorClass }) => {
    it(`should render "${label}" for status "${status}"`, () => {
      render(<FulfillmentStatusBadge status={status} />);

      const badge = screen.getByText(label);
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass(colorClass);
    });
  });

  it("should apply custom className", () => {
    render(<FulfillmentStatusBadge status="preparing" className="custom-class" />);

    const badge = screen.getByText("Preparing");
    expect(badge).toHaveClass("custom-class");
  });

  it("should have common badge styling classes", () => {
    render(<FulfillmentStatusBadge status="confirmed" />);

    const badge = screen.getByText("Confirmed");
    expect(badge).toHaveClass("inline-flex");
    expect(badge).toHaveClass("items-center");
    expect(badge).toHaveClass("rounded-full");
    expect(badge).toHaveClass("border");
    expect(badge).toHaveClass("text-xs");
    expect(badge).toHaveClass("font-semibold");
  });
});

describe("StatusBadge (legacy)", () => {
  it("should render payment status correctly", () => {
    render(<StatusBadge status="completed" />);
    expect(screen.getByText("Paid")).toBeInTheDocument();
  });

  it("should render fulfillment status correctly", () => {
    render(<StatusBadge status="preparing" />);
    expect(screen.getByText("Preparing")).toBeInTheDocument();
  });

  it("should render unknown status as-is with fallback styling", () => {
    render(<StatusBadge status="unknown_status" />);

    const badge = screen.getByText("unknown_status");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("bg-gray-100");
  });

  it("should apply custom className", () => {
    render(<StatusBadge status="completed" className="custom-class" />);

    const badge = screen.getByText("Paid");
    expect(badge).toHaveClass("custom-class");
  });

  // Test all payment statuses through legacy component
  const paymentStatusLabels: { status: OrderStatus; label: string }[] = [
    { status: "created", label: "Unpaid" },
    { status: "partial_paid", label: "Partial Paid" },
    { status: "completed", label: "Paid" },
    { status: "canceled", label: "Cancelled" },
  ];
  paymentStatusLabels.forEach(({ status, label }) => {
    it(`should handle payment status "${status}" via legacy component`, () => {
      render(<StatusBadge status={status} />);
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  // Test all fulfillment statuses through legacy component
  const fulfillmentStatusLabels: { status: FulfillmentStatus; label: string }[] = [
    { status: "pending", label: "Pending" },
    { status: "confirmed", label: "Confirmed" },
    { status: "preparing", label: "Preparing" },
    { status: "ready", label: "Ready" },
    { status: "fulfilled", label: "Fulfilled" },
  ];
  fulfillmentStatusLabels.forEach(({ status, label }) => {
    it(`should handle fulfillment status "${status}" via legacy component`, () => {
      render(<StatusBadge status={status} />);
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });
});

describe("StatusBadge Color Semantics", () => {
  it("should use yellow for unpaid orders (created)", () => {
    render(<PaymentStatusBadge status="created" />);
    const badge = screen.getByText("Unpaid");
    expect(badge).toHaveClass("text-yellow-800");
  });

  it("should use orange for partial payment", () => {
    render(<PaymentStatusBadge status="partial_paid" />);
    const badge = screen.getByText("Partial Paid");
    expect(badge).toHaveClass("text-orange-800");
  });

  it("should use green for paid orders", () => {
    render(<PaymentStatusBadge status="completed" />);
    const badge = screen.getByText("Paid");
    expect(badge).toHaveClass("text-green-800");
  });

  it("should use red for cancelled orders", () => {
    render(<PaymentStatusBadge status="canceled" />);
    const badge = screen.getByText("Cancelled");
    expect(badge).toHaveClass("text-red-800");
  });

  it("should use blue for confirmed fulfillment", () => {
    render(<FulfillmentStatusBadge status="confirmed" />);
    const badge = screen.getByText("Confirmed");
    expect(badge).toHaveClass("text-blue-800");
  });

  it("should use purple for preparing fulfillment", () => {
    render(<FulfillmentStatusBadge status="preparing" />);
    const badge = screen.getByText("Preparing");
    expect(badge).toHaveClass("text-purple-800");
  });

  it("should use green for ready fulfillment", () => {
    render(<FulfillmentStatusBadge status="ready" />);
    const badge = screen.getByText("Ready");
    expect(badge).toHaveClass("text-green-800");
  });
});
