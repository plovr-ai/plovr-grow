import { Section } from "@/components/website/ui/Section";
import { Container } from "@/components/website/ui/Container";
import { Icon } from "@/components/website/ui/Icon";
import type { Release } from "@/lib/content";

interface ReleaseTimelineProps {
  releases: Release[];
}

const formatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "2-digit",
});

export function ReleaseTimeline({ releases }: ReleaseTimelineProps) {
  return (
    <Section variant="default">
      <Container size="narrow">
        <div className="mx-auto max-w-3xl">
          {releases.map((r, i) => (
            <article
              key={r.slug}
              className={`grid gap-8 md:grid-cols-[140px_1fr] ${
                i > 0 ? "mt-16 border-t border-ws-border pt-16" : ""
              }`}
            >
              <div className="text-sm text-ws-text-subtle">
                {formatter.format(new Date(r.frontmatter.date))}
              </div>

              <div>
                <h2 className="font-[family-name:var(--font-manrope)] text-2xl font-bold md:text-3xl">
                  {r.frontmatter.title}
                </h2>

                {i === 0 && (
                  <div className="relative mt-6 aspect-[16/9] overflow-hidden rounded-xl border border-ws-border bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 shadow-md">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(245,184,0,0.15),transparent_50%)]" />
                    <div className="absolute inset-x-0 top-0 flex h-8 items-center gap-1.5 border-b border-white/5 px-3">
                      <span className="h-2 w-2 rounded-full bg-white/20" />
                      <span className="h-2 w-2 rounded-full bg-white/20" />
                      <span className="h-2 w-2 rounded-full bg-white/20" />
                    </div>
                    <div className="absolute inset-x-6 bottom-6 top-14 grid grid-cols-4 gap-2">
                      {Array.from({ length: 8 }).map((_, k) => (
                        <div
                          key={k}
                          className={`rounded-md ${
                            k % 3 === 0 ? "bg-ws-primary-500/30" : "bg-white/5"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div className="prose prose-sm mt-6 max-w-none text-ws-text-muted">
                  <p>{r.content.trim()}</p>
                </div>

                <ul className="mt-6 space-y-3">
                  {r.frontmatter.highlights.map((h) => (
                    <li key={h} className="flex gap-3 text-sm text-ws-text-muted">
                      <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-ws-primary-500 text-ws-text">
                        <Icon name="check" className="h-3 w-3" />
                      </span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </Container>
    </Section>
  );
}
