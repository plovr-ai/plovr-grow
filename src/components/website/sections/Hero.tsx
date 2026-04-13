import { Section } from "@/components/website/ui/Section";
import { Container } from "@/components/website/ui/Container";
import { Badge } from "@/components/website/ui/Badge";
import { WebsiteButton } from "@/components/website/ui/WebsiteButton";

interface HeroCta {
  label: string;
  href: string;
  external?: boolean;
}

interface HeroProps {
  eyebrow?: string;
  title: string;
  titleAccent?: string;
  description: string;
  primaryCta?: HeroCta;
  secondaryCta?: HeroCta;
  variant?: "default" | "warm";
}

export function Hero({
  eyebrow,
  title,
  titleAccent,
  description,
  primaryCta,
  secondaryCta,
  variant = "warm",
}: HeroProps) {
  return (
    <Section variant={variant} className="relative overflow-hidden">
      {/* Radial gradient amber overlay */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[480px]"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(245,184,0,0.22) 0%, rgba(245,184,0,0) 60%)",
        }}
      />
      <Container>
        <div className="relative z-10 mx-auto max-w-3xl text-center">
          {eyebrow && (
            <div className="mb-6 flex justify-center">
              <Badge>{eyebrow}</Badge>
            </div>
          )}
          <h1 className="font-display text-display-lg md:text-display-2xl">
            {title}
            {titleAccent && (
              <>
                {" "}
                <span className="text-primary-500">{titleAccent}</span>
              </>
            )}
          </h1>
          {description && (
            <p className="mt-6 text-body-lg text-text-muted md:text-xl">
              {description}
            </p>
          )}
          {(primaryCta || secondaryCta) && (
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              {primaryCta && (
                <WebsiteButton
                  href={primaryCta.href}
                  size="lg"
                  external={primaryCta.external}
                >
                  {primaryCta.label}
                </WebsiteButton>
              )}
              {secondaryCta && (
                <WebsiteButton
                  href={secondaryCta.href}
                  variant="secondary"
                  size="lg"
                  external={secondaryCta.external}
                >
                  {secondaryCta.label}
                </WebsiteButton>
              )}
            </div>
          )}
        </div>
      </Container>
    </Section>
  );
}
