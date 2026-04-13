import { Container } from "@/components/website/ui/Container";

interface ArticleLayoutProps {
  title: string;
  description: string;
  date: string;
  author: { name: string; role?: string };
  children: React.ReactNode;
}

const formatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

export function ArticleLayout({
  title,
  description,
  date,
  author,
  children,
}: ArticleLayoutProps) {
  return (
    <article className="py-16 md:py-24">
      <Container size="narrow">
        <header className="mx-auto max-w-3xl text-center">
          <div className="text-xs font-semibold uppercase tracking-wider text-amber-600">
            {formatter.format(new Date(date))}
          </div>
          <h1 className="mt-3 font-[family-name:var(--font-manrope)] text-4xl font-bold md:text-5xl">
            {title}
          </h1>
          <p className="mt-4 text-lg text-gray-500">{description}</p>
          <div className="mt-6 text-sm text-gray-900">
            <strong>{author.name}</strong>
            {author.role && (
              <span className="text-gray-500"> &middot; {author.role}</span>
            )}
          </div>
        </header>
        <div className="mx-auto mt-16 max-w-3xl">{children}</div>
      </Container>
    </article>
  );
}
