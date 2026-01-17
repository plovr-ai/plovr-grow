interface TipOptionButtonProps {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

export function TipOptionButton({
  selected,
  disabled = false,
  onClick,
  children,
}: TipOptionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
        selected
          ? "border-theme-primary bg-theme-primary-light text-theme-primary"
          : "border-gray-200 hover:border-gray-300 text-gray-600"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      {children}
    </button>
  );
}
