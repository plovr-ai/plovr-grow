interface SectionProps {
  variant?: "default" | "subtle" | "warm" | "dark";
  id?: string;
  className?: string;
  children: React.ReactNode;
}

const backgrounds: Record<NonNullable<SectionProps["variant"]>, string> = {
  default: "bg-white",
  subtle: "bg-ws-bg-subtle",
  warm: "bg-ws-bg-warm",
  dark: "bg-ws-dark text-white",
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
