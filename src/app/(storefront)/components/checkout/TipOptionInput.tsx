interface TipOptionInputProps {
  selected: boolean;
  disabled?: boolean;
  value: string;
  currencySymbol: string;
  onChange: (value: string) => void;
  onFocus: () => void;
}

export function TipOptionInput({
  selected,
  disabled = false,
  value,
  currencySymbol,
  onChange,
  onFocus,
}: TipOptionInputProps) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
        {currencySymbol}
      </span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        disabled={disabled}
        placeholder="Custom"
        min="0"
        step="0.01"
        className={`w-24 pl-7 pr-2 py-2 rounded-lg border-2 text-sm font-medium transition-colors
          focus:outline-none focus:border-red-600
          disabled:bg-gray-100 disabled:cursor-not-allowed
          [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
          ${selected ? "border-red-600 bg-red-50" : "border-gray-200"}`}
      />
    </div>
  );
}
