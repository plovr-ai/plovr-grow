import { siteConfig } from "@/config/site";

interface CTACardProps {
  title?: string;
  description?: string;
  cta?: { label: string; href: string; external?: boolean };
  variant?: "dark" | "light";
}

export function CTACard({
  title = "Unlock your AI partner for hospitality now!",
  description = "Join hundreds of restaurants already saving time and increasing revenue with AI agents.",
  cta = siteConfig.cta.secondary,
  variant = "light",
}: CTACardProps) {
  const isLight = variant === "light";

  return (
    <section className="relative bg-ws-bg-subtle px-6 md:px-16 py-24">
      <div
        className={`max-w-4xl mx-auto text-center rounded-3xl p-10 md:p-16 shadow-lg ${
          isLight ? "bg-white" : "bg-ws-dark"
        }`}
      >
        <h2
          className={`text-3xl md:text-5xl font-bold mb-6 ${
            isLight ? "text-ws-text" : "text-white"
          }`}
        >
          {title}
        </h2>
        <p
          className={`text-lg md:text-xl mb-8 max-w-2xl mx-auto ${
            isLight ? "text-ws-text-muted" : "text-ws-text-subtle"
          }`}
        >
          {description}
        </p>
        <a
          href={cta.href}
          rel={cta.external ? "noopener noreferrer" : undefined}
          target={cta.external ? "_blank" : undefined}
          className="inline-block px-10 py-5 bg-primary text-primary-foreground font-bold text-lg rounded-lg shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors"
        >
          {cta.label}
        </a>
      </div>
    </section>
  );
}
