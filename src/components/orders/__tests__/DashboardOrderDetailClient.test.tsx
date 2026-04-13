import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DashboardOrderDetailClient } from "../DashboardOrderDetailClient";
import { DashboardProvider } from "@/contexts";
import type { ReactNode } from "react";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
}));

function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <DashboardProvider
        value={{
          tenantId: "tenant-1",
          tenant: {
            id: "company-1",
            name: "Test Company",
            slug: "test-company",
            logoUrl: null,
          },
          merchants: [],
          currency: "USD",
          locale: "en-US",
          subscription: null,
        onboarding: { status: "not_started" as const, data: null },
        }}
      >
        {children}
      </DashboardProvider>
    );
  };
}

const mockOrder = {
  id: "order-123",
  orderNumber: "ORD-001",
  status: "completed",
  fulfillmentStatus: "confirmed",
  orderMode: "pickup",
  salesChannel: "online_order",
  paymentType: "online",
  items: [
    {
      menuItemId: "item-1",
      name: "Classic Burger",
      price: 12.99,
      quantity: 2,
      selectedModifiers: [],
      totalPrice: 25.98,
    },
    {
      menuItemId: "item-2",
      name: "French Fries",
      price: 4.99,
      quantity: 1,
      selectedModifiers: [
        {
          groupId: "group-1",
          groupName: "Size",
          modifierId: "mod-1",
          modifierName: "Large",
          price: 1.0,
          quantity: 1,
        },
      ],
      specialInstructions: "Extra crispy",
      totalPrice: 5.99,
    },
  ],
  customerFirstName: "John",
  customerLastName: "Doe",
  customerPhone: "+15551234567",
  customerEmail: "john@example.com",
  deliveryAddress: null,
  notes: "Test order notes",
  subtotal: 31.97,
  taxAmount: 2.56,
  tipAmount: 5.0,
  deliveryFee: 0,
  feesAmount: 0,
  feesBreakdown: [],
  discount: 0,
  totalAmount: 39.53,
  createdAt: new Date("2024-01-15T10:30:00Z"),
  paidAt: new Date("2024-01-15T10:32:00Z"),
  cancelledAt: null,
  cancelReason: null,
  timeline: [
    { status: "created" as const, timestamp: "2024-01-15T10:30:00Z" },
    { status: "completed" as const, timestamp: "2024-01-15T10:32:00Z" },
    { status: "confirmed" as const, timestamp: "2024-01-15T10:35:00Z" },
  ],
  merchant: {
    id: "merchant-1",
    name: "Downtown Location",
    slug: "downtown",
    timezone: "America/New_York",
  },
};

const mockImageMap: Record<string, string | null> = {
  "item-1": "https://example.com/burger.jpg",
  "item-2": "https://example.com/fries.jpg",
};

describe("DashboardOrderDetailClient", () => {
  describe("imageMap usage", () => {
    it("should display images from imageMap when available", () => {
      render(
        <DashboardOrderDetailClient order={mockOrder} imageMap={mockImageMap} />,
        { wrapper: createWrapper() }
      );

      // Check that images are rendered with correct src
      const images = screen.getAllByRole("img");
      expect(images).toHaveLength(2);
      expect(images[0]).toHaveAttribute("src", "https://example.com/burger.jpg");
      expect(images[0]).toHaveAttribute("alt", "Classic Burger");
      expect(images[1]).toHaveAttribute("src", "https://example.com/fries.jpg");
      expect(images[1]).toHaveAttribute("alt", "French Fries");
    });

    it("should display placeholder when imageMap has null value", () => {
      const imageMapWithNull: Record<string, string | null> = {
        "item-1": null,
        "item-2": "https://example.com/fries.jpg",
      };

      render(
        <DashboardOrderDetailClient order={mockOrder} imageMap={imageMapWithNull} />,
        { wrapper: createWrapper() }
      );

      // Only one image should be rendered (for item-2)
      const images = screen.getAllByRole("img");
      expect(images).toHaveLength(1);
      expect(images[0]).toHaveAttribute("src", "https://example.com/fries.jpg");
    });

    it("should display placeholder when item not in imageMap", () => {
      const partialImageMap: Record<string, string | null> = {
        "item-1": "https://example.com/burger.jpg",
        // item-2 is missing
      };

      render(
        <DashboardOrderDetailClient order={mockOrder} imageMap={partialImageMap} />,
        { wrapper: createWrapper() }
      );

      // Only one image should be rendered (for item-1)
      const images = screen.getAllByRole("img");
      expect(images).toHaveLength(1);
      expect(images[0]).toHaveAttribute("src", "https://example.com/burger.jpg");
    });

    it("should display all placeholders when imageMap is empty", () => {
      const emptyImageMap: Record<string, string | null> = {};

      render(
        <DashboardOrderDetailClient order={mockOrder} imageMap={emptyImageMap} />,
        { wrapper: createWrapper() }
      );

      // No images should be rendered
      const images = screen.queryAllByRole("img");
      expect(images).toHaveLength(0);

      // Should show placeholder SVGs instead (check for the container divs)
      const placeholders = document.querySelectorAll(".bg-gray-100.flex.items-center.justify-center");
      expect(placeholders.length).toBe(2);
    });
  });

  describe("order display", () => {
    it("should display order number in header", () => {
      render(
        <DashboardOrderDetailClient order={mockOrder} imageMap={mockImageMap} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText("Order #ORD-001")).toBeInTheDocument();
    });

    it("should display order status badge", () => {
      render(
        <DashboardOrderDetailClient order={mockOrder} imageMap={mockImageMap} />,
        { wrapper: createWrapper() }
      );

      // "Confirmed" appears in status badge and timeline as "Order Confirmed"
      const confirmedElements = screen.getAllByText(/Confirmed/);
      expect(confirmedElements.length).toBeGreaterThan(0);
    });

    it("should display order type and merchant name", () => {
      render(
        <DashboardOrderDetailClient order={mockOrder} imageMap={mockImageMap} />,
        { wrapper: createWrapper() }
      );

      // Multiple matches due to status progress showing "Ready for Pickup"
      const pickupElements = screen.getAllByText(/Pickup/);
      expect(pickupElements.length).toBeGreaterThan(0);

      // Downtown Location appears in header
      const merchantElements = screen.getAllByText(/Downtown Location/);
      expect(merchantElements.length).toBeGreaterThan(0);
    });

    it("should display item names and quantities", () => {
      render(
        <DashboardOrderDetailClient order={mockOrder} imageMap={mockImageMap} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText("Classic Burger")).toBeInTheDocument();
      expect(screen.getByText("French Fries")).toBeInTheDocument();
      expect(screen.getByText("2x")).toBeInTheDocument();
      expect(screen.getByText("1x")).toBeInTheDocument();
    });

    it("should display item count in header", () => {
      render(
        <DashboardOrderDetailClient order={mockOrder} imageMap={mockImageMap} />,
        { wrapper: createWrapper() }
      );

      // 2 + 1 = 3 items total
      expect(screen.getByText("Order Items (3 items)")).toBeInTheDocument();
    });

    it("should display modifiers when present", () => {
      render(
        <DashboardOrderDetailClient order={mockOrder} imageMap={mockImageMap} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText("Large")).toBeInTheDocument();
    });

    it("should display special instructions when present", () => {
      render(
        <DashboardOrderDetailClient order={mockOrder} imageMap={mockImageMap} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText("Extra crispy")).toBeInTheDocument();
    });

    it("should display customer information", () => {
      render(
        <DashboardOrderDetailClient order={mockOrder} imageMap={mockImageMap} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("john@example.com")).toBeInTheDocument();
    });

    it("should display price summary", () => {
      render(
        <DashboardOrderDetailClient order={mockOrder} imageMap={mockImageMap} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText("Payment Summary")).toBeInTheDocument();
      expect(screen.getByText("Subtotal")).toBeInTheDocument();
      expect(screen.getByText("Tax")).toBeInTheDocument();
      expect(screen.getByText("Tip")).toBeInTheDocument();
      expect(screen.getByText("Total")).toBeInTheDocument();
    });

    it("should display formatted prices", () => {
      render(
        <DashboardOrderDetailClient order={mockOrder} imageMap={mockImageMap} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText("$31.97")).toBeInTheDocument(); // Subtotal
      expect(screen.getByText("$39.53")).toBeInTheDocument(); // Total
    });

    it("should display order timeline", () => {
      render(
        <DashboardOrderDetailClient order={mockOrder} imageMap={mockImageMap} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText("Order Timeline")).toBeInTheDocument();
      expect(screen.getByText("Order Placed")).toBeInTheDocument();
      expect(screen.getByText("Order Confirmed")).toBeInTheDocument();
    });

    it("should display order notes", () => {
      render(
        <DashboardOrderDetailClient order={mockOrder} imageMap={mockImageMap} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText("Order Notes")).toBeInTheDocument();
      expect(screen.getByText("Test order notes")).toBeInTheDocument();
    });
  });

  describe("back link", () => {
    it("should have a link back to orders list", () => {
      render(
        <DashboardOrderDetailClient order={mockOrder} imageMap={mockImageMap} />,
        { wrapper: createWrapper() }
      );

      const backLink = document.querySelector('a[href="/dashboard/orders"]');
      expect(backLink).toBeInTheDocument();
    });
  });

  describe("delivery order", () => {
    const deliveryOrder = {
      ...mockOrder,
      orderMode: "delivery",
      deliveryFee: 5.99,
      deliveryAddress: {
        street: "123 Main St",
        apt: "Apt 4B",
        city: "New York",
        state: "NY",
        zipCode: "10001",
        instructions: "Leave at door",
      },
    };

    it("should display delivery address for delivery orders", () => {
      render(
        <DashboardOrderDetailClient order={deliveryOrder} imageMap={mockImageMap} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText("Delivery Address")).toBeInTheDocument();
      expect(screen.getByText(/123 Main St/)).toBeInTheDocument();
      expect(screen.getByText(/Apt 4B/)).toBeInTheDocument();
      expect(screen.getByText(/New York, NY 10001/)).toBeInTheDocument();
      expect(screen.getByText("Leave at door")).toBeInTheDocument();
    });

    it("should show delivery fee in price summary", () => {
      render(
        <DashboardOrderDetailClient order={deliveryOrder} imageMap={mockImageMap} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText("Delivery Fee")).toBeInTheDocument();
    });

    it("should display 'Out for Delivery' and 'Delivered' labels for delivery orders", () => {
      const paidDeliveryOrder = {
        ...deliveryOrder,
        status: "completed",
        fulfillmentStatus: "confirmed",
      };

      render(
        <DashboardOrderDetailClient order={paidDeliveryOrder} imageMap={mockImageMap} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText("Out for Delivery")).toBeInTheDocument();
      expect(screen.getByText("Delivered")).toBeInTheDocument();
    });
  });

  describe("cancelled order", () => {
    const cancelledOrder = {
      ...mockOrder,
      status: "canceled",
      cancelReason: "Customer requested cancellation",
      cancelledAt: new Date("2024-01-15T11:00:00Z"),
      timeline: [
        ...mockOrder.timeline,
        { status: "canceled" as const, timestamp: "2024-01-15T11:00:00Z" },
      ],
    };

    it("should show cancelled state in status progress", () => {
      render(
        <DashboardOrderDetailClient order={cancelledOrder} imageMap={mockImageMap} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText("Order Cancelled")).toBeInTheDocument();
      expect(screen.getByText("This order has been cancelled")).toBeInTheDocument();
    });

    it("should display cancel reason in timeline", () => {
      render(
        <DashboardOrderDetailClient order={cancelledOrder} imageMap={mockImageMap} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText(/Reason: Customer requested cancellation/)).toBeInTheDocument();
    });
  });

  describe("payment pending order", () => {
    it("should show awaiting payment state for created status", () => {
      const pendingOrder = {
        ...mockOrder,
        status: "created",
        paidAt: null,
      };

      render(
        <DashboardOrderDetailClient order={pendingOrder} imageMap={mockImageMap} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText("awaitingPayment")).toBeInTheDocument();
      expect(screen.getByText("awaitingPaymentMsg")).toBeInTheDocument();
    });

    it("should show partial payment state", () => {
      const partialOrder = {
        ...mockOrder,
        status: "partial_paid",
      };

      render(
        <DashboardOrderDetailClient order={partialOrder} imageMap={mockImageMap} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText("partialPaymentTitle")).toBeInTheDocument();
      expect(screen.getByText("partialPaymentMsg")).toBeInTheDocument();
    });
  });

  describe("in-store mark as paid", () => {
    const inStoreOrder = {
      ...mockOrder,
      status: "created",
      paymentType: "in_store",
      paidAt: null,
    };

    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
      vi.stubGlobal("confirm", vi.fn());
    });

    it("should show mark as paid button for in-store created orders", () => {
      render(
        <DashboardOrderDetailClient order={inStoreOrder} imageMap={mockImageMap} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText("awaitingInStorePayment")).toBeInTheDocument();
      expect(screen.getByText("actions.markAsPaid")).toBeInTheDocument();
    });

    it("should not show mark as paid button for online created orders", () => {
      const onlineOrder = { ...mockOrder, status: "created", paymentType: "online", paidAt: null };

      render(
        <DashboardOrderDetailClient order={onlineOrder} imageMap={mockImageMap} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText("awaitingPayment")).toBeInTheDocument();
      expect(screen.queryByText("actions.markAsPaid")).not.toBeInTheDocument();
    });

    it("should call API when mark as paid button is clicked and confirmed", async () => {
      vi.mocked(window.confirm).mockReturnValue(true);
      vi.mocked(globalThis.fetch).mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );

      render(
        <DashboardOrderDetailClient order={inStoreOrder} imageMap={mockImageMap} />,
        { wrapper: createWrapper() }
      );

      fireEvent.click(screen.getByText("actions.markAsPaid"));

      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalledWith(
          `/api/dashboard/${inStoreOrder.merchant.id}/orders/${inStoreOrder.id}/mark-paid`,
          expect.objectContaining({ method: "POST" })
        );
      });
    });

    it("should not call API when confirm is cancelled", () => {
      vi.mocked(window.confirm).mockReturnValue(false);

      render(
        <DashboardOrderDetailClient order={inStoreOrder} imageMap={mockImageMap} />,
        { wrapper: createWrapper() }
      );

      fireEvent.click(screen.getByText("actions.markAsPaid"));

      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it("should show error when API call fails", async () => {
      vi.mocked(window.confirm).mockReturnValue(true);
      vi.mocked(globalThis.fetch).mockResolvedValue(
        new Response(JSON.stringify({ success: false, error: "ORDER_NOT_ELIGIBLE_FOR_MARK_PAID" }), { status: 400 })
      );

      render(
        <DashboardOrderDetailClient order={inStoreOrder} imageMap={mockImageMap} />,
        { wrapper: createWrapper() }
      );

      fireEvent.click(screen.getByText("actions.markAsPaid"));

      await waitFor(() => {
        expect(screen.getByText("ORDER_NOT_ELIGIBLE_FOR_MARK_PAID")).toBeInTheDocument();
      });
    });

    it("should show fallback error when fetch throws", async () => {
      vi.mocked(window.confirm).mockReturnValue(true);
      vi.mocked(globalThis.fetch).mockRejectedValue(new Error("Network error"));

      render(
        <DashboardOrderDetailClient order={inStoreOrder} imageMap={mockImageMap} />,
        { wrapper: createWrapper() }
      );

      fireEvent.click(screen.getByText("actions.markAsPaid"));

      await waitFor(() => {
        expect(screen.getByText("Network error")).toBeInTheDocument();
      });
    });
  });

  describe("discount display", () => {
    it("should show discount when present", () => {
      const orderWithDiscount = {
        ...mockOrder,
        discount: 3.0,
      };

      render(
        <DashboardOrderDetailClient order={orderWithDiscount} imageMap={mockImageMap} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText("Discount")).toBeInTheDocument();
    });

    it("should not show discount when zero", () => {
      render(
        <DashboardOrderDetailClient order={mockOrder} imageMap={mockImageMap} />,
        { wrapper: createWrapper() }
      );

      expect(screen.queryByText("Discount")).not.toBeInTheDocument();
    });

    it("should not show delivery fee when zero", () => {
      render(
        <DashboardOrderDetailClient order={mockOrder} imageMap={mockImageMap} />,
        { wrapper: createWrapper() }
      );

      expect(screen.queryByText("Delivery Fee")).not.toBeInTheDocument();
    });
  });

  describe("no email customer", () => {
    it("should not render email when null", () => {
      const orderNoEmail = {
        ...mockOrder,
        customerEmail: null,
      };

      render(
        <DashboardOrderDetailClient order={orderNoEmail} imageMap={mockImageMap} />,
        { wrapper: createWrapper() }
      );

      expect(screen.queryByText("john@example.com")).not.toBeInTheDocument();
    });
  });

  describe("no notes", () => {
    it("should not render notes section when null", () => {
      const orderNoNotes = {
        ...mockOrder,
        notes: null,
      };

      render(
        <DashboardOrderDetailClient order={orderNoNotes} imageMap={mockImageMap} />,
        { wrapper: createWrapper() }
      );

      expect(screen.queryByText("Order Notes")).not.toBeInTheDocument();
    });
  });

  describe("item count singular", () => {
    it("should show singular 'item' when only 1 item with quantity 1", () => {
      const singleItemOrder = {
        ...mockOrder,
        items: [
          {
            menuItemId: "item-1",
            name: "Classic Burger",
            price: 12.99,
            quantity: 1,
            selectedModifiers: [],
            totalPrice: 12.99,
          },
        ],
      };

      render(
        <DashboardOrderDetailClient order={singleItemOrder} imageMap={mockImageMap} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText("Order Items (1 item)")).toBeInTheDocument();
    });
  });

  describe("sales channel labels", () => {
    it("should display catering label for catering orders", () => {
      const cateringOrder = {
        ...mockOrder,
        salesChannel: "catering",
      };

      render(
        <DashboardOrderDetailClient order={cateringOrder} imageMap={mockImageMap} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText(/Catering/)).toBeInTheDocument();
    });
  });

  describe("fulfillment progress", () => {
    it("should show Ready for Pickup for pickup orders", () => {
      render(
        <DashboardOrderDetailClient order={mockOrder} imageMap={mockImageMap} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText("Ready for Pickup")).toBeInTheDocument();
      expect(screen.getByText("Picked Up")).toBeInTheDocument();
    });

    it("should show fulfilled step as completed when order is fulfilled", () => {
      const fulfilledOrder = {
        ...mockOrder,
        fulfillmentStatus: "fulfilled",
      };

      render(
        <DashboardOrderDetailClient order={fulfilledOrder} imageMap={mockImageMap} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText("Picked Up")).toBeInTheDocument();
    });
  });

  describe("timeline with Date objects", () => {
    it("should handle Date object timestamps in timeline", () => {
      const orderWithDateTimeline = {
        ...mockOrder,
        timeline: [
          { status: "created" as const, timestamp: new Date("2024-01-15T10:30:00Z") },
          { status: "confirmed" as const, timestamp: new Date("2024-01-15T10:35:00Z") },
        ],
      };

      render(
        <DashboardOrderDetailClient order={orderWithDateTimeline} imageMap={mockImageMap} />,
        { wrapper: createWrapper() }
      );

      // Timeline should still render
      expect(screen.getByText("Order Timeline")).toBeInTheDocument();
    });

    it("should handle unknown timeline status with fallback config", () => {
      const orderWithUnknownStatus = {
        ...mockOrder,
        timeline: [
          { status: "created" as const, timestamp: "2024-01-15T10:30:00Z" },
          // Cast to allow unknown status
          { status: "unknown_status" as "created", timestamp: "2024-01-15T10:36:00Z" },
        ],
      };

      render(
        <DashboardOrderDetailClient order={orderWithUnknownStatus} imageMap={mockImageMap} />,
        { wrapper: createWrapper() }
      );

      // Should render with fallback label (the status string itself)
      expect(screen.getByText("unknown_status")).toBeInTheDocument();
    });
  });

  describe("phone number formatting", () => {
    it("should format 10-digit phone number", () => {
      const orderWith10DigitPhone = {
        ...mockOrder,
        customerPhone: "5551234567",
      };

      render(
        <DashboardOrderDetailClient order={orderWith10DigitPhone} imageMap={mockImageMap} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText("(555) 123-4567")).toBeInTheDocument();
    });

    it("should return raw phone for non-standard formats", () => {
      const orderWithOddPhone = {
        ...mockOrder,
        customerPhone: "12345",
      };

      render(
        <DashboardOrderDetailClient order={orderWithOddPhone} imageMap={mockImageMap} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText("12345")).toBeInTheDocument();
    });
  });
});
