interface ContainerProps {
  size?: "default" | "narrow";
  className?: string;
  children: React.ReactNode;
}

export function Container({
  size = "default",
  className = "",
  children,
}: ContainerProps) {
  const max = size === "narrow" ? "max-w-6xl" : "max-w-7xl";

  return (
    <div className={`mx-auto w-full px-6 md:px-8 ${max} ${className}`}>
      {children}
    </div>
  );
}
