import { siteConfig } from "@/config/site";

interface CTACardProps {
  title?: string;
  description?: string;
  cta?: { label: string; href: string; external?: boolean };
  variant?: "dark" | "light";
  decorative?: boolean;
}

export function CTACard({
  title = "Unlock your AI partner for hospitality now!",
  description = "Join the hundreds of managers who have reclaimed their time and increased their profits with localgrow.ai.",
  cta = siteConfig.cta.secondary,
  variant = "light",
  decorative = false,
}: CTACardProps) {
  const isLight = variant === "light";

  return (
    <section className="relative bg-ws-bg-subtle px-6 py-24 md:px-16">
      <div
        className={`relative mx-auto max-w-4xl overflow-hidden rounded-[48px] p-10 text-center shadow-lg md:p-16 ${
          isLight ? "bg-white" : "bg-ws-dark"
        }`}
      >
        {/* Decorative circles */}
        {decorative && (
          <>
            <div
              aria-hidden="true"
              className="absolute -right-32 -top-32 size-64 rounded-full bg-[rgba(255,191,0,0.05)]"
            />
            <div
              aria-hidden="true"
              className="absolute -bottom-32 -left-32 size-64 rounded-full bg-[rgba(121,89,0,0.05)]"
            />
          </>
        )}

        {/* Border overlay */}
        {decorative && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[48px] border border-[rgba(212,197,171,0.1)] shadow-2xl"
          />
        )}

        <h2
          className={`relative text-3xl font-extrabold leading-tight tracking-tight md:text-5xl ${
            isLight ? "text-ws-text-heading" : "text-white"
          }`}
        >
          {title}
        </h2>
        <p
          className={`relative mx-auto mt-6 max-w-2xl text-lg md:text-xl ${
            isLight ? "text-ws-text-body" : "text-ws-text-subtle"
          }`}
        >
          {description}
        </p>
        <div className="relative mt-8">
          <a
            href={cta.href}
            rel={cta.external ? "noopener noreferrer" : undefined}
            target={cta.external ? "_blank" : undefined}
            className="inline-block rounded-lg bg-primary px-10 py-5 text-lg font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90"
          >
            {cta.label}
          </a>
        </div>
      </div>
    </section>
  );
}
