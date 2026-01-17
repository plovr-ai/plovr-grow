"use client";

interface ContactInfo {
  customerName: string;
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
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <h2 className="text-sm font-medium text-gray-700 mb-3">
        Contact Information
      </h2>
      <div className="space-y-4">
        <div>
          <label
            htmlFor="customerName"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="customerName"
            value={values.customerName}
            onChange={(e) => onChange("customerName", e.target.value)}
            disabled={disabled}
            placeholder="Your full name"
            className={`w-full px-4 py-3 rounded-lg border placeholder:text-gray-400 ${
              errors.customerName
                ? "border-red-500 focus:ring-red-500"
                : "border-gray-300 focus:ring-red-600"
            } focus:outline-none focus:ring-2 focus:border-transparent transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed`}
          />
          {errors.customerName && (
            <p className="mt-1 text-sm text-red-500">{errors.customerName}</p>
          )}
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
            onChange={(e) => onChange("customerPhone", e.target.value)}
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
