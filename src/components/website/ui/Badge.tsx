interface BadgeProps {
  variant?: "primary" | "neutral" | "success";
  className?: string;
  children: React.ReactNode;
}

const variants: Record<NonNullable<BadgeProps["variant"]>, string> = {
  primary: "bg-[#fef0c7] text-[#b27900]",
  neutral: "bg-[#fafaf7] text-[#6b6b6b]",
  success: "bg-green-100 text-green-600",
};

export function Badge({
  variant = "primary",
  className = "",
  children,
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
