import { Section } from "@/components/website/ui/Section";
import { Container } from "@/components/website/ui/Container";
import { WebsiteButton } from "@/components/website/ui/WebsiteButton";
import { Badge } from "@/components/website/ui/Badge";
import { Icon } from "@/components/website/ui/Icon";

interface Plan {
  name: string;
  price: string;
  period?: string;
  description?: string;
  features: string[];
  cta: { label: string; href: string; external?: boolean };
  highlighted?: boolean;
  ctaVariant?: "primary" | "secondary" | "dark";
}

interface PricingTableProps {
  plans: Plan[];
  tabs?: string[];
  activeTab?: string;
}

export function PricingTable({
  plans,
  tabs = [],
  activeTab,
}: PricingTableProps) {
  const cols =
    plans.length === 3
      ? "md:grid-cols-3"
      : plans.length === 2
        ? "md:grid-cols-2"
        : "md:grid-cols-1";

  return (
    <Section variant="default">
      <Container size="narrow">
        {tabs.length > 0 && (
          <div className="mb-12 flex justify-center">
            <div
              role="tablist"
              className="inline-flex rounded-full border border-border bg-surface p-1 shadow-elev-sm"
            >
              {tabs.map((tab) => {
                const active = tab === activeTab;
                return (
                  <span
                    key={tab}
                    role="tab"
                    aria-selected={active}
                    className={`rounded-full px-5 py-2 text-body-sm font-medium transition-colors ${
                      active
                        ? "bg-primary-500 text-dark"
                        : "text-text-muted hover:text-text"
                    }`}
                  >
                    {tab}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        <div className={`grid gap-6 ${cols}`}>
          {plans.map((p) => {
            const ctaVariant =
              p.ctaVariant ?? (p.highlighted ? "primary" : "secondary");
            return (
              <div
                key={p.name}
                className={`relative flex flex-col rounded-xl border p-8 ${
                  p.highlighted
                    ? "border-primary-500 bg-bg-warm shadow-elev-glow"
                    : "border-border bg-surface shadow-elev-sm"
                }`}
              >
                {p.highlighted && (
                  <div className="absolute -top-3 left-8">
                    <Badge>Most popular</Badge>
                  </div>
                )}
                <h3 className="font-display text-h2">{p.name}</h3>
                {p.description && (
                  <p className="mt-2 text-body-sm text-text-muted">
                    {p.description}
                  </p>
                )}
                <div className="mt-6 flex items-baseline gap-2">
                  <span className="font-display text-display-lg">
                    {p.price}
                  </span>
                  {p.period && (
                    <span className="text-body-sm text-text-muted">
                      {p.period}
                    </span>
                  )}
                </div>

                <ul className="mt-6 flex-1 space-y-3">
                  {p.features.map((f) => (
                    <li
                      key={f}
                      className="flex gap-3 text-body-sm text-text-muted"
                    >
                      <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-primary-100 text-primary-700">
                        <Icon name="check" className="h-3 w-3" />
                      </span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-8">
                  <WebsiteButton
                    href={p.cta.href}
                    variant={ctaVariant}
                    external={p.cta.external}
                    className="w-full"
                  >
                    {p.cta.label}
                  </WebsiteButton>
                </div>
              </div>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}
