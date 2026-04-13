import Link from "next/link";

interface WebsiteButtonProps {
  href?: string;
  variant?: "primary" | "secondary" | "ghost" | "dark";
  size?: "sm" | "md" | "lg";
  type?: "button" | "submit";
  className?: string;
  external?: boolean;
  children: React.ReactNode;
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5b800] focus-visible:ring-offset-2";

const variantStyles: Record<NonNullable<WebsiteButtonProps["variant"]>, string> = {
  primary: "bg-[#f5b800] text-[#0f0f0f] hover:bg-[#fdb022]",
  secondary: "bg-white text-[#0a0a0a] border border-[#ececec] hover:bg-[#fafaf7]",
  ghost: "bg-transparent text-[#0a0a0a] hover:bg-[#fafaf7]",
  dark: "bg-[#0f0f0f] text-white hover:bg-[#1c1c1c]",
};

const sizeStyles: Record<NonNullable<WebsiteButtonProps["size"]>, string> = {
  sm: "text-sm px-4 py-2",
  md: "text-base px-6 py-3",
  lg: "text-lg px-8 py-4",
};

export function WebsiteButton({
  href,
  variant = "primary",
  size = "md",
  type = "button",
  className = "",
  external = false,
  children,
}: WebsiteButtonProps) {
  const cls = `${base} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`;

  if (href) {
    if (external) {
      return (
        <a
          href={href}
          className={cls}
          rel="noopener noreferrer"
          target="_blank"
        >
          {children}
        </a>
      );
    }

    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} className={cls}>
      {children}
    </button>
  );
}
