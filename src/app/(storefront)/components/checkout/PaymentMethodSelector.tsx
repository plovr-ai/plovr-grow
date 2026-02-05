"use client";

export type PaymentOption = "cash" | "card";

interface PaymentMethodSelectorProps {
  value: PaymentOption;
  onChange: (option: PaymentOption) => void;
  disabled?: boolean;
  orderMode: string;
}

export function PaymentMethodSelector({
  value,
  onChange,
  disabled,
  orderMode,
}: PaymentMethodSelectorProps) {
  const cashLabel =
    orderMode === "delivery" ? "Pay at Delivery" : "Pay at Pickup";

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <h2 className="text-sm font-medium text-gray-700 mb-3">Payment Method</h2>
      <div className="space-y-2">
        {/* Pay Now with Card */}
        <label
          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
            value === "card"
              ? "border-theme-primary bg-theme-primary-light"
              : "border-gray-200 hover:border-gray-300"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <input
            type="radio"
            name="paymentMethod"
            value="card"
            checked={value === "card"}
            onChange={() => onChange("card")}
            disabled={disabled}
            className="w-4 h-4 text-theme-primary focus:ring-theme-primary"
          />
          <div className="flex items-center gap-2 flex-1">
            <CreditCardIcon className="w-5 h-5 text-gray-600" />
            <span className="font-medium text-gray-900">Pay Now with Card</span>
          </div>
          <div className="flex items-center gap-1">
            <VisaIcon className="h-6" />
            <MastercardIcon className="h-6" />
            <AmexIcon className="h-6" />
          </div>
        </label>

        {/* Pay at Pickup/Delivery */}
        <label
          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
            value === "cash"
              ? "border-theme-primary bg-theme-primary-light"
              : "border-gray-200 hover:border-gray-300"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <input
            type="radio"
            name="paymentMethod"
            value="cash"
            checked={value === "cash"}
            onChange={() => onChange("cash")}
            disabled={disabled}
            className="w-4 h-4 text-theme-primary focus:ring-theme-primary"
          />
          <div className="flex items-center gap-2 flex-1">
            <CashIcon className="w-5 h-5 text-gray-600" />
            <span className="font-medium text-gray-900">{cashLabel}</span>
          </div>
        </label>
      </div>
    </div>
  );
}

// Icons
function CreditCardIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
      />
    </svg>
  );
}

function CashIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
      />
    </svg>
  );
}

function VisaIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 32" fill="none">
      <rect width="48" height="32" rx="4" fill="#1A1F71" />
      <path
        d="M19.5 21h-3l1.875-11.5h3L19.5 21zm8.125-11.225c-.594-.225-1.531-.469-2.688-.469-2.969 0-5.062 1.5-5.078 3.656-.016 1.594 1.5 2.484 2.641 3.016 1.172.547 1.563.891 1.563 1.375-.016.75-.938 1.094-1.797 1.094-1.203 0-1.844-.172-2.828-.578l-.391-.188-.422 2.469c.703.313 2 .578 3.344.594 3.156 0 5.203-1.484 5.234-3.781.016-1.266-.797-2.234-2.547-3.031-.5-.25-.766-.406-1.063-.516-.266-.125-.5-.266-.5-.469.016-.359.422-.672 1.234-.672.813-.016 1.391.156 1.828.328l.219.109.328-2.031zm7.844-.275h-2.32c-.719 0-1.266.203-1.578.922l-4.484 10.203h3.156l.625-1.641h3.859l.359 1.641h2.781L35.469 9.5zm-3.703 7.641c.25-.641 1.219-3.109 1.219-3.109-.016.031.25-.656.406-1.078l.203.969.703 3.219h-2.531zM14.5 9.5l-2.938 7.844-.313-1.516c-.531-1.703-2.188-3.547-4.047-4.469l2.688 9.625h3.172L17.687 9.5H14.5z"
        fill="#fff"
      />
    </svg>
  );
}

function MastercardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 32" fill="none">
      <rect width="48" height="32" rx="4" fill="#F5F5F5" />
      <circle cx="19" cy="16" r="9" fill="#EB001B" />
      <circle cx="29" cy="16" r="9" fill="#F79E1B" />
      <path
        d="M24 9.5c2.188 1.734 3.594 4.375 3.594 7.313 0 2.937-1.406 5.578-3.594 7.312A9.558 9.558 0 0120.406 16c0-2.938 1.406-5.578 3.594-7.5z"
        fill="#FF5F00"
      />
    </svg>
  );
}

function AmexIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 32" fill="none">
      <rect width="48" height="32" rx="4" fill="#006FCF" />
      <path
        d="M9 12h3l.5 1.5.5-1.5h3v6h-2v-4l-1 4h-1.5l-1-4v4H9v-6zm8 0h2.5l1.5 4 1.5-4H25v6h-2v-4l-1.5 4h-1l-1.5-4v4h-2v-6zm9 0h4v1.5h-2v1h2v1.5h-2v.5h2V18h-4v-6zm5 0h2v4.5h2V18h-4v-6z"
        fill="#fff"
      />
    </svg>
  );
}
