import Link from "next/link";

interface LogoProps {
  className?: string;
  variant?: "dark" | "light";
}

export function Logo({ className = "", variant = "dark" }: LogoProps) {
  const textColor = variant === "light" ? "text-white" : "text-[#0a0a0a]";

  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-2 ${className}`}
      aria-label="LocalGrow home"
    >
      <img
        src="/logo.svg"
        alt=""
        width={28}
        height={28}
        aria-hidden="true"
      />
      <span
        className={`font-[family-name:var(--font-manrope)] text-base font-extrabold tracking-tight ${textColor}`}
      >
        LocalGrow.ai
      </span>
    </Link>
  );
}
