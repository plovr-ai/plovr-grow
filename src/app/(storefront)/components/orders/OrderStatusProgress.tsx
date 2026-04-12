"use client";

import type { OrderStatus, FulfillmentStatus, OrderMode } from "@/types";

interface Props {
  paymentStatus: OrderStatus;
  fulfillmentStatus: FulfillmentStatus;
  orderMode: OrderMode;
}

interface FulfillmentStep {
  status: FulfillmentStatus;
  label: string;
}

const FULFILLMENT_STEPS: FulfillmentStep[] = [
  { status: "pending", label: "Pending" },
  { status: "confirmed", label: "Confirmed" },
  { status: "preparing", label: "Preparing" },
  { status: "ready", label: "Ready" },
  { status: "fulfilled", label: "Fulfilled" },
];

const FULFILLMENT_ORDER: Record<FulfillmentStatus, number> = {
  pending: 0,
  confirmed: 1,
  preparing: 2,
  ready: 3,
  fulfilled: 4,
};

export function OrderStatusProgress({ paymentStatus, fulfillmentStatus, orderMode }: Props) {
  const isCancelled = paymentStatus === "canceled";
  const isPaymentFailed = paymentStatus === "payment_failed";
  const isPaid = paymentStatus === "completed";

  // Show cancelled state
  if (isCancelled) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <div>
            <p className="font-medium text-red-800">Order Cancelled</p>
            <p className="text-sm text-red-600">
              This order has been cancelled
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show payment failed state
  if (isPaymentFailed) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-rose-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <div>
            <p className="font-medium text-rose-800">Payment Failed</p>
            <p className="text-sm text-rose-600">
              The payment attempt was unsuccessful. Please try again.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show payment pending state
  if (!isPaid) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-yellow-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div>
            <p className="font-medium text-yellow-800">
              {paymentStatus === "partial_paid" ? "Partial Payment Received" : "Awaiting Payment"}
            </p>
            <p className="text-sm text-yellow-600">
              {paymentStatus === "partial_paid"
                ? "Please complete the remaining payment"
                : "Please complete the payment to proceed"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show fulfillment progress for paid orders
  const currentIndex = FULFILLMENT_ORDER[fulfillmentStatus];
  const readyLabel = orderMode === "delivery" ? "Out for Delivery" : "Ready for Pickup";
  const fulfilledLabel = orderMode === "delivery" ? "Delivered" : "Picked Up";
  const stepsWithLabels = FULFILLMENT_STEPS.map((step) => {
    if (step.status === "ready") return { ...step, label: readyLabel };
    if (step.status === "fulfilled") return { ...step, label: fulfilledLabel };
    return step;
  });

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-center justify-between">
        {stepsWithLabels.map((step, index) => {
          const stepIndex = FULFILLMENT_ORDER[step.status];
          const isCompleted = stepIndex < currentIndex;
          const isCurrent = stepIndex === currentIndex;

          return (
            <div key={step.status} className="flex-1 flex items-center">
              {/* Step circle */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                    isCompleted
                      ? "bg-theme-primary text-theme-primary-foreground"
                      : isCurrent
                        ? "bg-theme-primary text-theme-primary-foreground ring-4 ring-theme-primary-light"
                        : "bg-gray-200 text-gray-400"
                  }`}
                >
                  {isCompleted ? (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    <span className="text-sm font-medium">{index + 1}</span>
                  )}
                </div>
                <span
                  className={`text-xs mt-1.5 text-center ${
                    isCurrent
                      ? "font-medium text-theme-primary-hover"
                      : isCompleted
                        ? "text-gray-600"
                        : "text-gray-400"
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {/* Connecting line */}
              {index < stepsWithLabels.length - 1 && (
                <div
                  className={`flex-1 h-1 mx-2 rounded ${
                    stepIndex < currentIndex
                      ? "bg-theme-primary"
                      : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
