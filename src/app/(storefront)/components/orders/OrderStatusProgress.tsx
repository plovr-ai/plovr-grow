"use client";

import type { OrderStatus, OrderMode } from "@/types";

interface Props {
  currentStatus: OrderStatus;
  orderMode: OrderMode;
}

interface StatusStep {
  status: OrderStatus;
  label: string;
}

const STEPS: StatusStep[] = [
  { status: "pending", label: "Placed" },
  { status: "confirmed", label: "Confirmed" },
  { status: "preparing", label: "Preparing" },
  { status: "ready", label: "Ready" },
  { status: "completed", label: "Completed" },
];

const STATUS_ORDER: Record<OrderStatus, number> = {
  pending: 0,
  confirmed: 1,
  preparing: 2,
  ready: 3,
  completed: 4,
  cancelled: -1,
};

export function OrderStatusProgress({ currentStatus, orderMode }: Props) {
  const currentIndex = STATUS_ORDER[currentStatus];
  const isCancelled = currentStatus === "cancelled";

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

  const readyLabel = orderMode === "delivery" ? "Out for Delivery" : "Ready for Pickup";
  const stepsWithLabels = STEPS.map((step) =>
    step.status === "ready" ? { ...step, label: readyLabel } : step
  );

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-center justify-between">
        {stepsWithLabels.map((step, index) => {
          const stepIndex = STATUS_ORDER[step.status];
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
