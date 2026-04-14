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
  variant?: "default" | "subtle" | "card";
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
  // Card variant uses custom bg instead of Section
  if (variant === "card") {
    return (
      <section className="bg-ws-bg-card px-6 py-24 md:px-8">
        <Container>
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center text-3xl font-extrabold text-ws-text-heading md:text-5xl">
              {title}
            </h2>
            {description && (
              <p className="mt-4 text-center text-lg text-ws-text-body">
                {description}
              </p>
            )}
            <div className="mt-12 space-y-4">
              {items.map((item) => (
                <details
                  key={item.question}
                  className="group rounded-[32px] bg-white p-6"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-ws-text-heading">
                    <span>{item.question}</span>
                    <svg
                      className="ml-4 size-3 shrink-0 text-ws-text-amber transition-transform group-open:rotate-180"
                      viewBox="0 0 12 7.4"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M1.41 0L6 4.58 10.59 0 12 1.41l-6 6-6-6L1.41 0z" />
                    </svg>
                  </summary>
                  <p className="mt-4 pr-10 text-sm leading-relaxed text-ws-text-body">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </Container>
      </section>
    );
  }

  return (
    <Section variant={variant === "subtle" ? "subtle" : "default"}>
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
            <h2 className="text-center text-3xl font-extrabold text-ws-text-heading md:text-5xl">
              {title}
            </h2>
            {description && (
              <p className="mt-4 text-center text-lg text-ws-text-body">
                {description}
              </p>
            )}
            <div className="mt-12 space-y-4">
              {items.map((item) => (
                <details
                  key={item.question}
                  className="group rounded-[32px] bg-white p-6 shadow-sm"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-ws-text-heading">
                    <span>{item.question}</span>
                    <svg
                      className="ml-4 size-3 shrink-0 text-ws-text-amber transition-transform group-open:rotate-180"
                      viewBox="0 0 12 7.4"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M1.41 0L6 4.58 10.59 0 12 1.41l-6 6-6-6L1.41 0z" />
                    </svg>
                  </summary>
                  <p className="mt-4 pr-10 text-sm leading-relaxed text-ws-text-body">
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
