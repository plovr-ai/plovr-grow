import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { CardPaymentForm, type CardPaymentFormRef } from "../CardPaymentForm";
import { createRef } from "react";

// Mock @stripe/react-stripe-js
const mockSubmit = vi.fn();
const mockConfirmPayment = vi.fn();
const mockStripe = { confirmPayment: mockConfirmPayment };
const mockElements = { submit: mockSubmit };

let mockStripeReady = true;
let mockElementsReady = true;

vi.mock("@stripe/react-stripe-js", () => ({
  PaymentElement: ({ onReady }: { onReady: () => void }) => {
    // Simulate ready callback
    setTimeout(() => onReady(), 0);
    return <div data-testid="payment-element">PaymentElement</div>;
  },
  useStripe: () => (mockStripeReady ? mockStripe : null),
  useElements: () => (mockElementsReady ? mockElements : null),
}));

describe("CardPaymentForm", () => {
  const defaultProps = {
    onReady: vi.fn(),
    onError: vi.fn(),
    disabled: false,
    defaultCountry: "US",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStripeReady = true;
    mockElementsReady = true;
    mockSubmit.mockReset();
    mockConfirmPayment.mockReset();
  });

  it("should render PaymentElement and security notice", () => {
    render(<CardPaymentForm {...defaultProps} />);
    expect(screen.getByTestId("payment-element")).toBeInTheDocument();
    expect(screen.getByText("Card Details")).toBeInTheDocument();
    expect(screen.getByText("Your payment info is encrypted and secure")).toBeInTheDocument();
  });

  it("should call onReady when stripe, elements and payment element are ready", async () => {
    vi.useFakeTimers();
    render(<CardPaymentForm {...defaultProps} />);

    await act(async () => {
      vi.advanceTimersByTime(10);
    });

    // onReady should be called since stripe + elements + isReady are all true
    expect(defaultProps.onReady).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("should expose confirmPayment via ref", async () => {
    mockSubmit.mockResolvedValue({ error: null });
    mockConfirmPayment.mockResolvedValue({
      error: null,
      paymentIntent: { status: "succeeded" },
    });

    const ref = createRef<CardPaymentFormRef>();
    render(<CardPaymentForm {...defaultProps} ref={ref} />);

    const result = await ref.current!.confirmPayment();
    expect(result).toEqual({ success: true });
    expect(mockSubmit).toHaveBeenCalled();
    expect(mockConfirmPayment).toHaveBeenCalled();
  });

  it("should return error when stripe is not ready", async () => {
    mockStripeReady = false;

    const ref = createRef<CardPaymentFormRef>();
    render(<CardPaymentForm {...defaultProps} ref={ref} />);

    const result = await ref.current!.confirmPayment();
    expect(result).toEqual({
      success: false,
      error: "Payment system not ready",
    });
  });

  it("should return error when elements is not ready", async () => {
    mockElementsReady = false;

    const ref = createRef<CardPaymentFormRef>();
    render(<CardPaymentForm {...defaultProps} ref={ref} />);

    const result = await ref.current!.confirmPayment();
    expect(result).toEqual({
      success: false,
      error: "Payment system not ready",
    });
  });

  it("should handle submit error from elements.submit()", async () => {
    mockSubmit.mockResolvedValue({
      error: { message: "Card number incomplete" },
    });

    const ref = createRef<CardPaymentFormRef>();
    render(<CardPaymentForm {...defaultProps} ref={ref} />);

    const result = await ref.current!.confirmPayment();
    expect(result).toEqual({
      success: false,
      error: "Card number incomplete",
    });
    expect(defaultProps.onError).toHaveBeenCalledWith("Card number incomplete");
  });

  it("should handle submit error with no message", async () => {
    mockSubmit.mockResolvedValue({
      error: {},
    });

    const ref = createRef<CardPaymentFormRef>();
    render(<CardPaymentForm {...defaultProps} ref={ref} />);

    const result = await ref.current!.confirmPayment();
    expect(result).toEqual({
      success: false,
      error: "Please check your card details",
    });
  });

  it("should handle confirmPayment error from stripe", async () => {
    mockSubmit.mockResolvedValue({ error: null });
    mockConfirmPayment.mockResolvedValue({
      error: { message: "Card declined" },
    });

    const ref = createRef<CardPaymentFormRef>();
    render(<CardPaymentForm {...defaultProps} ref={ref} />);

    const result = await ref.current!.confirmPayment();
    expect(result).toEqual({
      success: false,
      error: "Card declined",
    });
    expect(defaultProps.onError).toHaveBeenCalledWith("Card declined");
  });

  it("should handle confirmPayment error with no message", async () => {
    mockSubmit.mockResolvedValue({ error: null });
    mockConfirmPayment.mockResolvedValue({
      error: {},
    });

    const ref = createRef<CardPaymentFormRef>();
    render(<CardPaymentForm {...defaultProps} ref={ref} />);

    const result = await ref.current!.confirmPayment();
    expect(result).toEqual({
      success: false,
      error: "Payment failed",
    });
  });

  it("should handle processing payment status", async () => {
    mockSubmit.mockResolvedValue({ error: null });
    mockConfirmPayment.mockResolvedValue({
      error: null,
      paymentIntent: { status: "processing" },
    });

    const ref = createRef<CardPaymentFormRef>();
    render(<CardPaymentForm {...defaultProps} ref={ref} />);

    const result = await ref.current!.confirmPayment();
    expect(result).toEqual({ success: true });
  });

  it("should handle unexpected payment status", async () => {
    mockSubmit.mockResolvedValue({ error: null });
    mockConfirmPayment.mockResolvedValue({
      error: null,
      paymentIntent: { status: "requires_action" },
    });

    const ref = createRef<CardPaymentFormRef>();
    render(<CardPaymentForm {...defaultProps} ref={ref} />);

    const result = await ref.current!.confirmPayment();
    expect(result).toEqual({
      success: false,
      error: "Payment status: requires_action",
    });
  });

  it("should handle thrown exception during payment", async () => {
    mockSubmit.mockResolvedValue({ error: null });
    mockConfirmPayment.mockRejectedValue(new Error("Network timeout"));

    const ref = createRef<CardPaymentFormRef>();
    render(<CardPaymentForm {...defaultProps} ref={ref} />);

    const result = await ref.current!.confirmPayment();
    expect(result).toEqual({
      success: false,
      error: "Network timeout",
    });
    expect(defaultProps.onError).toHaveBeenCalledWith("Network timeout");
  });

  it("should handle non-Error exception during payment", async () => {
    mockSubmit.mockResolvedValue({ error: null });
    mockConfirmPayment.mockRejectedValue("unknown error");

    const ref = createRef<CardPaymentFormRef>();
    render(<CardPaymentForm {...defaultProps} ref={ref} />);

    const result = await ref.current!.confirmPayment();
    expect(result).toEqual({
      success: false,
      error: "Payment failed",
    });
  });

  it("should handle undefined paymentIntent status", async () => {
    mockSubmit.mockResolvedValue({ error: null });
    mockConfirmPayment.mockResolvedValue({
      error: null,
      paymentIntent: undefined,
    });

    const ref = createRef<CardPaymentFormRef>();
    render(<CardPaymentForm {...defaultProps} ref={ref} />);

    const result = await ref.current!.confirmPayment();
    expect(result).toEqual({
      success: false,
      error: "Payment status: undefined",
    });
  });
});
