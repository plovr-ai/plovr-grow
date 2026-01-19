"use client";

import { useFormatPhone } from "@/hooks";
import type { OrderType, DeliveryAddress } from "@/types";

interface Props {
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  orderType: OrderType;
  deliveryAddress: DeliveryAddress | null;
  notes: string | null;
}

export function CustomerInfo({
  customerName,
  customerPhone,
  customerEmail,
  orderType,
  deliveryAddress,
  notes,
}: Props) {
  const formatPhone = useFormatPhone();

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
      {/* Contact Information */}
      <div>
        <h2 className="text-sm font-medium text-gray-700 mb-2">
          Contact Information
        </h2>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-gray-600">
            <svg
              className="w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            <span>{customerName}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <svg
              className="w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
              />
            </svg>
            <span>{formatPhone(customerPhone)}</span>
          </div>
          {customerEmail && (
            <div className="flex items-center gap-2 text-gray-600">
              <svg
                className="w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              <span>{customerEmail}</span>
            </div>
          )}
        </div>
      </div>

      {/* Delivery Address */}
      {orderType === "delivery" && deliveryAddress && (
        <div>
          <h2 className="text-sm font-medium text-gray-700 mb-2">
            Delivery Address
          </h2>
          <div className="flex items-start gap-2 text-gray-600">
            <svg
              className="w-4 h-4 text-gray-400 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <div>
              <p>
                {deliveryAddress.street}
                {deliveryAddress.apt && `, ${deliveryAddress.apt}`}
              </p>
              <p>
                {deliveryAddress.city}, {deliveryAddress.state}{" "}
                {deliveryAddress.zipCode}
              </p>
              {deliveryAddress.instructions && (
                <p className="text-gray-400 text-sm mt-1 italic">
                  {deliveryAddress.instructions}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Order Notes */}
      {notes && (
        <div>
          <h2 className="text-sm font-medium text-gray-700 mb-2">
            Order Notes
          </h2>
          <div className="flex items-start gap-2 text-gray-600">
            <svg
              className="w-4 h-4 text-gray-400 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="italic">{notes}</p>
          </div>
        </div>
      )}
    </div>
  );
}
