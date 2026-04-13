import { Section } from "@/components/website/ui/Section";
import { Container } from "@/components/website/ui/Container";

interface MissionBlockProps {
  title: string;
  description: string;
}

export function MissionBlock({ title, description }: MissionBlockProps) {
  return (
    <Section variant="subtle">
      <Container size="narrow">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-display-lg">{title}</h2>
          <p className="mt-6 text-body-lg text-text-muted">{description}</p>
        </div>
      </Container>
    </Section>
  );
}
