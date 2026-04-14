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
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-primary-500 focus-visible:ring-offset-2";

const variantStyles: Record<NonNullable<WebsiteButtonProps["variant"]>, string> = {
  primary: "bg-ws-primary-500 text-[#402D00] hover:bg-ws-primary-400",
  secondary: "bg-white text-ws-text border border-ws-border hover:bg-ws-bg-subtle",
  ghost: "bg-transparent text-ws-text hover:bg-ws-bg-subtle",
  dark: "bg-ws-dark text-white hover:bg-ws-dark-muted",
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
