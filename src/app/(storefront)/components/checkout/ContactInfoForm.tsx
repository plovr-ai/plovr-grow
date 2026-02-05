"use client";

import { usePhoneInput } from "@/hooks";

interface ContactInfo {
  customerFirstName: string;
  customerLastName: string;
  customerPhone: string;
  customerEmail: string;
}

interface ContactInfoFormProps {
  values: ContactInfo;
  errors: Partial<Record<keyof ContactInfo, string>>;
  onChange: (field: keyof ContactInfo, value: string) => void;
  disabled?: boolean;
}

export function ContactInfoForm({
  values,
  errors,
  onChange,
  disabled = false,
}: ContactInfoFormProps) {
  const { format: formatPhoneInput } = usePhoneInput();

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneInput(e.target.value);
    onChange("customerPhone", formatted);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <h2 className="text-sm font-medium text-gray-700 mb-3">
        Contact Information
      </h2>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="customerFirstName"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              First Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="customerFirstName"
              value={values.customerFirstName}
              onChange={(e) => onChange("customerFirstName", e.target.value)}
              disabled={disabled}
              placeholder="John"
              autoComplete="given-name"
              className={`w-full px-4 py-3 rounded-lg border placeholder:text-gray-400 ${
                errors.customerFirstName
                  ? "border-red-500 focus:ring-red-500"
                  : "border-gray-300 focus:ring-red-600"
              } focus:outline-none focus:ring-2 focus:border-transparent transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed`}
            />
            {errors.customerFirstName && (
              <p className="mt-1 text-sm text-red-500">{errors.customerFirstName}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="customerLastName"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Last Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="customerLastName"
              value={values.customerLastName}
              onChange={(e) => onChange("customerLastName", e.target.value)}
              disabled={disabled}
              placeholder="Doe"
              autoComplete="family-name"
              className={`w-full px-4 py-3 rounded-lg border placeholder:text-gray-400 ${
                errors.customerLastName
                  ? "border-red-500 focus:ring-red-500"
                  : "border-gray-300 focus:ring-red-600"
              } focus:outline-none focus:ring-2 focus:border-transparent transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed`}
            />
            {errors.customerLastName && (
              <p className="mt-1 text-sm text-red-500">{errors.customerLastName}</p>
            )}
          </div>
        </div>

        <div>
          <label
            htmlFor="customerPhone"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Phone <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            id="customerPhone"
            value={values.customerPhone}
            onChange={handlePhoneChange}
            disabled={disabled}
            placeholder="(555) 123-4567"
            className={`w-full px-4 py-3 rounded-lg border placeholder:text-gray-400 ${
              errors.customerPhone
                ? "border-red-500 focus:ring-red-500"
                : "border-gray-300 focus:ring-red-600"
            } focus:outline-none focus:ring-2 focus:border-transparent transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed`}
          />
          {errors.customerPhone && (
            <p className="mt-1 text-sm text-red-500">{errors.customerPhone}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="customerEmail"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Email <span className="text-gray-400">(optional)</span>
          </label>
          <input
            type="email"
            id="customerEmail"
            value={values.customerEmail}
            onChange={(e) => onChange("customerEmail", e.target.value)}
            disabled={disabled}
            placeholder="your@email.com"
            className={`w-full px-4 py-3 rounded-lg border placeholder:text-gray-400 ${
              errors.customerEmail
                ? "border-red-500 focus:ring-red-500"
                : "border-gray-300 focus:ring-red-600"
            } focus:outline-none focus:ring-2 focus:border-transparent transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed`}
          />
          {errors.customerEmail && (
            <p className="mt-1 text-sm text-red-500">{errors.customerEmail}</p>
          )}
        </div>
      </div>
    </div>
  );
}
