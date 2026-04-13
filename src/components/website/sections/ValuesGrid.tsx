import { Section } from "@/components/website/ui/Section";
import { Container } from "@/components/website/ui/Container";

interface Value {
  label: string;
  description: string;
}

interface ValuesGridProps {
  values: Value[];
}

export function ValuesGrid({ values }: ValuesGridProps) {
  return (
    <Section variant="default" className="!pt-0">
      <Container size="narrow">
        <div className="grid gap-10 md:grid-cols-3 md:gap-12">
          {values.map((v) => (
            <div key={v.label}>
              <div className="text-caption font-semibold uppercase tracking-wider text-primary-600">
                {v.label}
              </div>
              <p className="mt-3 text-body-sm text-text-muted">
                {v.description}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}
