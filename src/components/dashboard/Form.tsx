"use client";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDashboardCurrencySymbol } from "@/hooks";

// ============================================================================
// Types
// ============================================================================

export type FormLayout = "horizontal" | "vertical";

export interface BaseFieldProps {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  layout?: FormLayout;
  labelWidth?: number;
  className?: string;
}

interface FormFieldProps extends BaseFieldProps {
  children: React.ReactNode;
  alignTop?: boolean;
}

// ============================================================================
// FormField - Base container component
// ============================================================================

export function FormField({
  id,
  label,
  required,
  error,
  layout = "horizontal",
  labelWidth = 120,
  alignTop = false,
  className,
  children,
}: FormFieldProps) {
  if (layout === "horizontal") {
    return (
      <div
        className={cn(
          "grid gap-4",
          alignTop ? "items-start" : "items-center",
          className
        )}
        style={{ gridTemplateColumns: `${labelWidth}px 1fr` }}
      >
        <Label
          htmlFor={id}
          className={cn("text-right", alignTop && "pt-2")}
        >
          {label}
          {required && <span className="text-red-500"> *</span>}
        </Label>
        <div>
          {children}
          {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
        </div>
      </div>
    );
  }

  // Vertical layout
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-red-500"> *</span>}
      </Label>
      {children}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}

// ============================================================================
// TextField
// ============================================================================

interface TextFieldProps extends BaseFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "email" | "password" | "number";
  step?: string;
  min?: string | number;
  max?: string | number;
  disabled?: boolean;
  inputClassName?: string;
}

export function TextField({
  id,
  label,
  required,
  error,
  layout = "horizontal",
  labelWidth,
  className,
  value,
  onChange,
  placeholder,
  type = "text",
  step,
  min,
  max,
  disabled,
  inputClassName,
}: TextFieldProps) {
  return (
    <FormField
      id={id}
      label={label}
      required={required}
      error={error}
      layout={layout}
      labelWidth={labelWidth}
      className={className}
    >
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        step={step}
        min={min}
        max={max}
        disabled={disabled}
        aria-invalid={!!error}
        className={inputClassName}
      />
    </FormField>
  );
}

// ============================================================================
// TextareaField
// ============================================================================

interface TextareaFieldProps extends BaseFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  inputClassName?: string;
}

export function TextareaField({
  id,
  label,
  required,
  error,
  layout = "horizontal",
  labelWidth,
  className,
  value,
  onChange,
  placeholder,
  rows = 3,
  disabled,
  inputClassName,
}: TextareaFieldProps) {
  return (
    <FormField
      id={id}
      label={label}
      required={required}
      error={error}
      layout={layout}
      labelWidth={labelWidth}
      alignTop
      className={className}
    >
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        aria-invalid={!!error}
        className={cn(
          "w-full rounded-md border border-gray-300 px-3 py-2 text-sm",
          "focus:border-theme-primary focus:outline-none focus:ring-1 focus:ring-theme-primary",
          "disabled:bg-gray-50 disabled:cursor-not-allowed",
          inputClassName
        )}
      />
    </FormField>
  );
}

// ============================================================================
// PriceField
// ============================================================================

interface PriceFieldProps extends BaseFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  maxWidth?: string;
}

export function PriceField({
  id,
  label,
  required,
  error,
  layout = "horizontal",
  labelWidth,
  className,
  value,
  onChange,
  placeholder = "0.00",
  disabled,
  maxWidth = "max-w-[200px]",
}: PriceFieldProps) {
  const currencySymbol = useDashboardCurrencySymbol();

  return (
    <FormField
      id={id}
      label={label}
      required={required}
      error={error}
      layout={layout}
      labelWidth={labelWidth}
      className={className}
    >
      <div className={cn("relative", maxWidth)}>
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
          {currencySymbol}
        </span>
        <Input
          id={id}
          type="number"
          step="0.01"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={!!error}
          className="pl-7"
        />
      </div>
    </FormField>
  );
}

// ============================================================================
// SelectField
// ============================================================================

interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps extends BaseFieldProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
  inputClassName?: string;
}

export function SelectField({
  id,
  label,
  required,
  error,
  layout = "horizontal",
  labelWidth,
  className,
  value,
  onChange,
  options,
  disabled,
  inputClassName,
}: SelectFieldProps) {
  return (
    <FormField
      id={id}
      label={label}
      required={required}
      error={error}
      layout={layout}
      labelWidth={labelWidth}
      className={className}
    >
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-invalid={!!error}
        className={cn(
          "h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm",
          "focus:border-theme-primary focus:outline-none focus:ring-1 focus:ring-theme-primary",
          "disabled:bg-gray-50 disabled:cursor-not-allowed",
          inputClassName
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FormField>
  );
}

// ============================================================================
// RadioGroupField
// ============================================================================

interface RadioOption {
  value: string;
  label: string;
}

interface RadioGroupFieldProps extends BaseFieldProps {
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: RadioOption[];
  disabled?: boolean;
}

export function RadioGroupField({
  id,
  name,
  label,
  required,
  error,
  layout = "horizontal",
  labelWidth,
  className,
  value,
  onChange,
  options,
  disabled,
}: RadioGroupFieldProps) {
  return (
    <FormField
      id={id}
      label={label}
      required={required}
      error={error}
      layout={layout}
      labelWidth={labelWidth}
      className={className}
    >
      <div className="flex gap-6">
        {options.map((option) => (
          <label key={option.value} className="flex items-center gap-2">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              disabled={disabled}
              className="h-4 w-4 text-theme-primary"
            />
            <span className="text-sm">{option.label}</span>
          </label>
        ))}
      </div>
    </FormField>
  );
}

// ============================================================================
// CheckboxField
// ============================================================================

interface CheckboxFieldProps extends BaseFieldProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  checkboxLabel?: string;
  disabled?: boolean;
}

export function CheckboxField({
  id,
  label,
  required,
  error,
  layout = "horizontal",
  labelWidth,
  className,
  checked,
  onChange,
  checkboxLabel,
  disabled,
}: CheckboxFieldProps) {
  return (
    <FormField
      id={id}
      label={label}
      required={required}
      error={error}
      layout={layout}
      labelWidth={labelWidth}
      className={className}
    >
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="h-4 w-4 rounded border-gray-300 text-theme-primary focus:ring-theme-primary"
        />
        {checkboxLabel && <span className="text-sm">{checkboxLabel}</span>}
      </label>
    </FormField>
  );
}
