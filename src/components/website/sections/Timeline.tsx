import { Section } from "@/components/website/ui/Section";
import { Container } from "@/components/website/ui/Container";

interface TimelineEntry {
  year: string;
  title: string;
  description: string;
}

interface TimelineProps {
  title?: string;
  entries: TimelineEntry[];
  layout?: "stacked" | "split";
  variant?: "default" | "subtle";
}

export function Timeline({
  title = "The Journey",
  entries,
  layout = "split",
  variant = "subtle",
}: TimelineProps) {
  return (
    <Section variant={variant}>
      <Container size="narrow">
        {layout === "split" ? (
          <div className="grid gap-10 md:grid-cols-[1fr_2fr] md:gap-16">
            <h2 className="font-display text-display-lg">{title}</h2>
            <div className="space-y-8">
              {entries.map((e) => (
                <div key={e.year} className="flex gap-4">
                  <span className="mt-2 inline-block h-2 w-2 flex-none rounded-full bg-primary-500" />
                  <div className="min-w-0">
                    <div className="text-caption font-semibold uppercase tracking-wider text-primary-600">
                      {e.year}
                    </div>
                    <h3 className="mt-1 font-display text-h3">{e.title}</h3>
                    <p className="mt-2 text-body-sm text-text-muted">
                      {e.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <h2 className="font-display text-display-lg">{title}</h2>
            <div className="mt-12 grid gap-10">
              {entries.map((e) => (
                <div
                  key={e.year}
                  className="grid gap-4 border-t border-border pt-6 md:grid-cols-[140px_1fr]"
                >
                  <div className="text-body-sm font-semibold uppercase tracking-wider text-primary-600">
                    {e.year}
                  </div>
                  <div>
                    <h3 className="font-display text-h2">{e.title}</h3>
                    <p className="mt-2 text-body text-text-muted">
                      {e.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Container>
    </Section>
  );
}
