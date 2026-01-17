"use client";

import { US_STATES } from "@storefront/lib/validations/checkout";

interface DeliveryAddress {
  street: string;
  apt: string;
  city: string;
  state: string;
  zipCode: string;
  instructions: string;
}

interface DeliveryAddressFormProps {
  values: DeliveryAddress;
  errors: Partial<Record<keyof DeliveryAddress, string>>;
  onChange: (field: keyof DeliveryAddress, value: string) => void;
  disabled?: boolean;
}

export function DeliveryAddressForm({
  values,
  errors,
  onChange,
  disabled = false,
}: DeliveryAddressFormProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <h2 className="text-sm font-medium text-gray-700 mb-3">
        Delivery Address
      </h2>
      <div className="space-y-4">
        <div>
          <label
            htmlFor="street"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Street Address <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="street"
            value={values.street}
            onChange={(e) => onChange("street", e.target.value)}
            disabled={disabled}
            placeholder="123 Main St"
            className={`w-full px-4 py-3 rounded-lg border placeholder:text-gray-400 ${
              errors.street
                ? "border-red-500 focus:ring-red-500"
                : "border-gray-300 focus:ring-red-600"
            } focus:outline-none focus:ring-2 focus:border-transparent transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed`}
          />
          {errors.street && (
            <p className="mt-1 text-sm text-red-500">{errors.street}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="apt"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Apt / Suite <span className="text-gray-400">(optional)</span>
          </label>
          <input
            type="text"
            id="apt"
            value={values.apt}
            onChange={(e) => onChange("apt", e.target.value)}
            disabled={disabled}
            placeholder="Apt 4B"
            className={`w-full px-4 py-3 rounded-lg border placeholder:text-gray-400 ${
              errors.apt
                ? "border-red-500 focus:ring-red-500"
                : "border-gray-300 focus:ring-red-600"
            } focus:outline-none focus:ring-2 focus:border-transparent transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed`}
          />
          {errors.apt && (
            <p className="mt-1 text-sm text-red-500">{errors.apt}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="city"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              City <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="city"
              value={values.city}
              onChange={(e) => onChange("city", e.target.value)}
              disabled={disabled}
              placeholder="New York"
              className={`w-full px-4 py-3 rounded-lg border placeholder:text-gray-400 ${
                errors.city
                  ? "border-red-500 focus:ring-red-500"
                  : "border-gray-300 focus:ring-red-600"
              } focus:outline-none focus:ring-2 focus:border-transparent transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed`}
            />
            {errors.city && (
              <p className="mt-1 text-sm text-red-500">{errors.city}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="state"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              State <span className="text-red-500">*</span>
            </label>
            <select
              id="state"
              value={values.state}
              onChange={(e) => onChange("state", e.target.value)}
              disabled={disabled}
              className={`w-full px-4 py-3 rounded-lg border ${
                errors.state
                  ? "border-red-500 focus:ring-red-500"
                  : "border-gray-300 focus:ring-red-600"
              } focus:outline-none focus:ring-2 focus:border-transparent transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed`}
            >
              <option value="">Select</option>
              {US_STATES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
            {errors.state && (
              <p className="mt-1 text-sm text-red-500">{errors.state}</p>
            )}
          </div>
        </div>

        <div>
          <label
            htmlFor="zipCode"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            ZIP Code <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="zipCode"
            value={values.zipCode}
            onChange={(e) => onChange("zipCode", e.target.value)}
            disabled={disabled}
            placeholder="10001"
            className={`w-full px-4 py-3 rounded-lg border placeholder:text-gray-400 ${
              errors.zipCode
                ? "border-red-500 focus:ring-red-500"
                : "border-gray-300 focus:ring-red-600"
            } focus:outline-none focus:ring-2 focus:border-transparent transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed`}
          />
          {errors.zipCode && (
            <p className="mt-1 text-sm text-red-500">{errors.zipCode}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="instructions"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Delivery Instructions{" "}
            <span className="text-gray-400">(optional)</span>
          </label>
          <textarea
            id="instructions"
            value={values.instructions}
            onChange={(e) => onChange("instructions", e.target.value)}
            disabled={disabled}
            placeholder="Gate code, building entrance, etc."
            rows={2}
            className={`w-full px-4 py-3 rounded-lg border placeholder:text-gray-400 ${
              errors.instructions
                ? "border-red-500 focus:ring-red-500"
                : "border-gray-300 focus:ring-red-600"
            } focus:outline-none focus:ring-2 focus:border-transparent transition-colors resize-none disabled:bg-gray-100 disabled:cursor-not-allowed`}
          />
          {errors.instructions && (
            <p className="mt-1 text-sm text-red-500">{errors.instructions}</p>
          )}
        </div>
      </div>
    </div>
  );
}
