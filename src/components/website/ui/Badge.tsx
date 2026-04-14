interface BadgeProps {
  variant?: "primary" | "neutral" | "success";
  className?: string;
  children: React.ReactNode;
}

const variants: Record<NonNullable<BadgeProps["variant"]>, string> = {
  primary: "bg-ws-primary-100 text-ws-primary-700",
  neutral: "bg-ws-bg-subtle text-ws-text-muted",
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
