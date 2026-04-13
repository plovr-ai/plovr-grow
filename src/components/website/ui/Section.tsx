interface SectionProps {
  variant?: "default" | "subtle" | "warm" | "dark";
  id?: string;
  className?: string;
  children: React.ReactNode;
}

const backgrounds: Record<NonNullable<SectionProps["variant"]>, string> = {
  default: "bg-white",
  subtle: "bg-[#fafaf7]",
  warm: "bg-[#fff8e9]",
  dark: "bg-[#0f0f0f] text-white",
};

export function Section({
  variant = "default",
  id,
  className = "",
  children,
}: SectionProps) {
  return (
    <section id={id} className={`${backgrounds[variant]} py-16 md:py-24 ${className}`}>
      {children}
    </section>
  );
}
