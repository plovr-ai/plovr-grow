import { Section } from "@/components/website/ui/Section";
import { Container } from "@/components/website/ui/Container";

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQProps {
  title?: string;
  titleBreak?: string;
  description?: string;
  items: FAQItem[];
  variant?: "default" | "subtle";
  layout?: "stacked" | "split";
}

export function FAQ({
  title = "Frequently Asked Questions",
  titleBreak,
  description,
  items,
  variant = "default",
  layout = "stacked",
}: FAQProps) {
  return (
    <Section variant={variant}>
      <Container>
        {layout === "split" ? (
          <div className="grid gap-10 md:grid-cols-[1fr_2fr] md:gap-16">
            <div>
              <h2 className="font-display text-display-lg">
                {title}
                {titleBreak && (
                  <>
                    <br />
                    {titleBreak}
                  </>
                )}
              </h2>
              {description && (
                <p className="mt-4 text-body-lg text-text-muted">
                  {description}
                </p>
              )}
            </div>
            <div className="divide-y divide-border">
              {items.map((item) => (
                <details key={item.question} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between text-body font-semibold">
                    <span>{item.question}</span>
                    <span className="ml-4 text-2xl text-text-muted transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 pr-10 text-body-sm text-text-muted">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center font-display text-display-lg">
              {title}
            </h2>
            {description && (
              <p className="mt-4 text-center text-body-lg text-text-muted">
                {description}
              </p>
            )}
            <div className="mt-12 divide-y divide-border rounded-xl border border-border bg-surface">
              {items.map((item) => (
                <details key={item.question} className="group px-6">
                  <summary className="flex cursor-pointer list-none items-center justify-between py-5 text-body font-semibold">
                    <span>{item.question}</span>
                    <span className="ml-4 text-2xl text-text-muted transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="pb-6 pr-10 text-body-sm text-text-muted">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        )}
      </Container>
    </Section>
  );
}
